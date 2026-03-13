import type { TranscriptionResult } from "./whisper.js";
import type { QualityResult } from "./quality.js";
import type { PacingResult } from "./pacing.js";
import type { TextDiffResult } from "./diff.js";

interface ReportInput {
  audio_path: string;
  transcription: TranscriptionResult;
  quality: QualityResult;
  pacing: PacingResult;
  diff: TextDiffResult | null;
}

export function formatFullReport(input: ReportInput): string {
  const { audio_path, transcription, quality, pacing, diff } = input;

  const lines: string[] = [];

  lines.push(`TTS Analysis Report`);
  lines.push(`File: ${audio_path}`);
  lines.push(`Duration: ${quality.duration_s}s | Words: ${pacing.total_words} | Rate: ${pacing.speaking_rate_wpm} WPM`);
  lines.push("");

  // Transcription
  lines.push("--- Transcription ---");
  lines.push(transcription.text);
  lines.push("");

  // Quality Scores
  lines.push("--- Quality Scores ---");
  lines.push(`Pitch: mean ${quality.pitch.mean_hz}Hz, std ${quality.pitch.std_hz}Hz, range ${quality.pitch.range_hz}Hz`);
  lines.push(`  ${quality.pitch.interpretation}${quality.pitch.monotone_risk ? " [MONOTONE RISK]" : ""}`);
  lines.push(`Energy: RMS ${quality.energy.mean_rms}, dynamic range ${quality.energy.dynamic_range_db}dB`);
  lines.push(`  ${quality.energy.interpretation}`);
  lines.push(`Silence ratio: ${(quality.silence_ratio * 100).toFixed(1)}%`);
  lines.push(`Overall: ${quality.overall_assessment}`);
  if (quality.issues.length > 0) {
    for (const issue of quality.issues) {
      lines.push(`  ! ${issue}`);
    }
  }
  lines.push("");

  // Pacing
  lines.push("--- Pacing Analysis ---");
  lines.push(`Speaking rate: ${pacing.speaking_rate_wpm} WPM (natural: 120-180)`);
  lines.push(`${pacing.interpretation}`);
  if (pacing.long_pauses.length > 0) {
    lines.push("Long pauses:");
    for (const pause of pacing.long_pauses) {
      lines.push(`  ${pause.gap_ms}ms gap between "${pause.after_word}" and "${pause.before_word}"`);
    }
  }
  if (pacing.rushed_segments.length > 0) {
    lines.push("Rushed words:");
    for (const rush of pacing.rushed_segments) {
      lines.push(`  "${rush.word}" spoken in ${rush.duration_ms}ms`);
    }
  }
  if (pacing.issues.length > 0) {
    for (const issue of pacing.issues) {
      lines.push(`  ! ${issue}`);
    }
  }
  lines.push("");

  // Mispronunciation diff
  if (diff) {
    lines.push("--- Pronunciation Check ---");
    lines.push(`Expected: ${diff.expected}`);
    lines.push(`Got:      ${diff.got}`);
    lines.push(`WER: ${(diff.wer * 100).toFixed(1)}%`);
    lines.push(diff.summary);
    if (diff.substitutions.length > 0) {
      lines.push("Substitutions:");
      for (const sub of diff.substitutions) {
        lines.push(`  "${sub.expected}" -> "${sub.got}" (word #${sub.position + 1})`);
      }
    }
    if (diff.insertions.length > 0) {
      lines.push("Inserted words:");
      for (const ins of diff.insertions) {
        lines.push(`  "${ins.word}" at position ${ins.position + 1}`);
      }
    }
    if (diff.deletions.length > 0) {
      lines.push("Deleted words:");
      for (const del of diff.deletions) {
        lines.push(`  "${del.word}" at position ${del.position + 1}`);
      }
    }
    lines.push("");
  }

  // Summary of all issues
  const allIssues = [
    ...quality.issues,
    ...pacing.issues,
    ...(diff && diff.wer > 0 ? [`WER ${(diff.wer * 100).toFixed(1)}% — ${diff.summary}`] : []),
  ];

  if (allIssues.length > 0) {
    lines.push("--- Issues Summary ---");
    for (let i = 0; i < allIssues.length; i++) {
      lines.push(`${i + 1}. ${allIssues[i]}`);
    }
  } else {
    lines.push("--- No Issues Detected ---");
    lines.push("TTS output appears normal.");
  }

  return lines.join("\n");
}
