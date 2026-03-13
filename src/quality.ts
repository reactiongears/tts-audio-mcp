import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const PYTHON_BIN =
  process.env.TTS_PYTHON_BIN ??
  join(
    process.env.HOME ?? "",
    "Documents/_dev/tts-audio-mcp/.venv/bin/python3",
  );

export interface QualityResult {
  duration_s: number;
  silence_ratio: number;
  pitch: {
    mean_hz: number;
    std_hz: number;
    range_hz: number;
    monotone_risk: boolean;
    interpretation: string;
  };
  energy: {
    mean_rms: number;
    dynamic_range_db: number;
    interpretation: string;
  };
  overall_assessment: string;
  issues: string[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const ANALYSIS_SCRIPT = `
import sys, json, warnings
warnings.filterwarnings("ignore")

import librosa
import numpy as np

audio_path = sys.argv[1]

y, sr = librosa.load(audio_path, sr=16000)
duration = len(y) / sr

# Energy / RMS
rms = librosa.feature.rms(y=y, frame_length=512, hop_length=256)[0]
threshold = np.mean(rms) * 0.3
silence_ratio = float(np.sum(rms < threshold) / len(rms))

# Pitch analysis
f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
f0_voiced = f0[~np.isnan(f0)]
pitch_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0
pitch_std = float(np.std(f0_voiced)) if len(f0_voiced) > 0 else 0
pitch_range = float(np.ptp(f0_voiced)) if len(f0_voiced) > 0 else 0

# Energy stats
mean_rms = float(np.mean(rms))
rms_positive = rms[rms > 0]
if len(rms_positive) > 1:
    dynamic_range = float(20 * np.log10(np.max(rms) / (np.min(rms_positive) + 1e-10)))
else:
    dynamic_range = 0.0

result = {
    "duration_s": round(duration, 2),
    "silence_ratio": round(silence_ratio, 3),
    "pitch_mean_hz": round(pitch_mean, 1),
    "pitch_std_hz": round(pitch_std, 1),
    "pitch_range_hz": round(pitch_range, 1),
    "mean_rms": round(mean_rms, 4),
    "dynamic_range_db": round(dynamic_range, 1),
}

print(json.dumps(result))
`;

function interpretPitch(stdHz: number, _rangeHz: number): string {
  if (stdHz < 15) return "Very monotone — sounds robotic";
  if (stdHz < 25) return "Low variation — slightly flat";
  if (stdHz < 50) return "Normal variation";
  if (stdHz < 80) return "Good variation — expressive";
  return "High variation — possibly unstable";
}

function interpretEnergy(dynamicRangeDb: number): string {
  if (dynamicRangeDb < 10) return "Very compressed — flat dynamics";
  if (dynamicRangeDb < 25) return "Low dynamics — may sound flat";
  if (dynamicRangeDb < 50) return "Normal dynamics";
  return "Wide dynamic range";
}

function assessOverall(
  silenceRatio: number,
  pitchStd: number,
  dynamicRange: number,
): { assessment: string; issues: string[] } {
  const issues: string[] = [];

  if (silenceRatio > 0.5) issues.push("Excessive silence (>50% of audio)");
  if (silenceRatio < 0.1)
    issues.push("Very little silence — may sound rushed");
  if (pitchStd < 15) issues.push("Monotone pitch — sounds robotic");
  if (pitchStd < 25) issues.push("Low pitch variation — sounds flat");
  if (dynamicRange < 10) issues.push("Over-compressed audio — no dynamics");
  if (dynamicRange > 70) issues.push("Very wide dynamic range — may clip");

  if (issues.length === 0) {
    return { assessment: "Audio quality appears normal", issues };
  }
  if (issues.length <= 2) {
    return {
      assessment: `Minor issues detected (${issues.length})`,
      issues,
    };
  }
  return {
    assessment: `Multiple issues detected (${issues.length})`,
    issues,
  };
}

export async function analyzeAudioQuality(
  audioPath: string,
): Promise<QualityResult> {
  if (!(await fileExists(audioPath))) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const { stdout } = await execFileAsync(
    PYTHON_BIN,
    ["-c", ANALYSIS_SCRIPT, audioPath],
    { timeout: 30000 },
  );

  const raw = JSON.parse(stdout.trim()) as {
    duration_s: number;
    silence_ratio: number;
    pitch_mean_hz: number;
    pitch_std_hz: number;
    pitch_range_hz: number;
    mean_rms: number;
    dynamic_range_db: number;
  };

  const pitchInterp = interpretPitch(raw.pitch_std_hz, raw.pitch_range_hz);
  const energyInterp = interpretEnergy(raw.dynamic_range_db);
  const { assessment, issues } = assessOverall(
    raw.silence_ratio,
    raw.pitch_std_hz,
    raw.dynamic_range_db,
  );

  return {
    duration_s: raw.duration_s,
    silence_ratio: raw.silence_ratio,
    pitch: {
      mean_hz: raw.pitch_mean_hz,
      std_hz: raw.pitch_std_hz,
      range_hz: raw.pitch_range_hz,
      monotone_risk: raw.pitch_std_hz < 20,
      interpretation: pitchInterp,
    },
    energy: {
      mean_rms: raw.mean_rms,
      dynamic_range_db: raw.dynamic_range_db,
      interpretation: energyInterp,
    },
    overall_assessment: assessment,
    issues,
  };
}
