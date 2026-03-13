import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

const WHISPER_BINARY = process.env.WHISPER_BINARY ?? "whisper-cli";
const WHISPER_MODEL =
  process.env.WHISPER_MODEL_PATH ??
  join(
    process.env.HOME ?? "",
    "Documents/_dev/tts-audio-mcp/models/ggml-large-v3-turbo.bin",
  );

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration_ms: number;
  segments: Array<{
    start_ms: number;
    end_ms: number;
    text: string;
  }>;
  words: WordTimestamp[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function convertToWav(inputPath: string): Promise<string> {
  const outPath = join(tmpdir(), `tts-mcp-${randomUUID()}.wav`);
  await execFileAsync("ffmpeg", [
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-y",
    outPath,
  ]);
  return outPath;
}

export async function transcribe(
  audioPath: string,
  language: string = "en",
): Promise<TranscriptionResult> {
  if (!(await fileExists(audioPath))) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Convert non-wav files
  let wavPath = audioPath;
  let needsCleanup = false;
  if (!audioPath.endsWith(".wav")) {
    wavPath = await convertToWav(audioPath);
    needsCleanup = true;
  }

  const outBase = join(tmpdir(), `tts-mcp-${randomUUID()}`);

  try {
    await execFileAsync(
      WHISPER_BINARY,
      [
        "-m",
        WHISPER_MODEL,
        "-f",
        wavPath,
        "--output-json",
        "--output-file",
        outBase,
        "-l",
        language,
        "--max-len",
        "1",
        "--split-on-word",
      ],
      { timeout: 60000 },
    );

    const jsonPath = `${outBase}.json`;
    const raw = await readFile(jsonPath, "utf-8");
    const data = JSON.parse(raw) as {
      transcription: Array<{
        timestamps: { from: string; to: string };
        offsets: { from: number; to: number };
        text: string;
        tokens?: Array<{
          text: string;
          timestamps: { from: string; to: string };
          offsets: { from: number; to: number };
        }>;
      }>;
    };

    const segments = data.transcription.map((seg) => ({
      start_ms: seg.offsets.from,
      end_ms: seg.offsets.to,
      text: seg.text.trim(),
    }));

    const fullText = segments.map((s) => s.text).join(" ");

    // With --max-len 1 --split-on-word, each segment is a single word.
    // Extract word-level timestamps directly from segments.
    const words: WordTimestamp[] = [];
    for (const seg of data.transcription) {
      const word = seg.text.trim();
      if (word) {
        words.push({
          word,
          start_ms: seg.offsets.from,
          end_ms: seg.offsets.to,
        });
      }
    }

    const lastSegment = segments[segments.length - 1];
    const durationMs = lastSegment ? lastSegment.end_ms : 0;

    // Cleanup temp files
    await unlink(jsonPath).catch(() => {});

    return {
      text: fullText,
      language,
      duration_ms: durationMs,
      segments,
      words,
    };
  } finally {
    if (needsCleanup) {
      await unlink(wavPath).catch(() => {});
    }
  }
}
