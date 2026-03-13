import type { TranscriptionResult } from "./whisper.js";

export interface PacingResult {
  speaking_rate_wpm: number;
  total_words: number;
  duration_s: number;
  long_pauses: Array<{
    after_word: string;
    before_word: string;
    gap_ms: number;
    position: number;
  }>;
  rushed_segments: Array<{
    word: string;
    duration_ms: number;
    position: number;
  }>;
  interpretation: string;
  issues: string[];
}

const NATURAL_WPM_MIN = 120;
const NATURAL_WPM_MAX = 180;
const LONG_PAUSE_THRESHOLD_MS = 500;
const RUSHED_WORD_MIN_MS = 80;

export function analyzePacing(
  transcription: TranscriptionResult,
): PacingResult {
  const { words, duration_ms } = transcription;
  const durationS = duration_ms / 1000;
  const totalWords = words.length;
  const wpm = durationS > 0 ? (totalWords / durationS) * 60 : 0;

  const longPauses: PacingResult["long_pauses"] = [];
  const rushedSegments: PacingResult["rushed_segments"] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordDuration = word.end_ms - word.start_ms;

    // Check for rushed words
    if (wordDuration < RUSHED_WORD_MIN_MS && word.word.length > 2) {
      rushedSegments.push({
        word: word.word,
        duration_ms: wordDuration,
        position: i,
      });
    }

    // Check for long pauses between words
    if (i < words.length - 1) {
      const next = words[i + 1];
      const gap = next.start_ms - word.end_ms;
      if (gap > LONG_PAUSE_THRESHOLD_MS) {
        longPauses.push({
          after_word: word.word,
          before_word: next.word,
          gap_ms: gap,
          position: i,
        });
      }
    }
  }

  const issues: string[] = [];
  if (wpm < NATURAL_WPM_MIN)
    issues.push(
      `Speaking rate too slow: ${Math.round(wpm)} WPM (natural: ${NATURAL_WPM_MIN}-${NATURAL_WPM_MAX})`,
    );
  if (wpm > NATURAL_WPM_MAX)
    issues.push(
      `Speaking rate too fast: ${Math.round(wpm)} WPM (natural: ${NATURAL_WPM_MIN}-${NATURAL_WPM_MAX})`,
    );
  if (longPauses.length > 0)
    issues.push(
      `${longPauses.length} unnatural pause(s) detected (>${LONG_PAUSE_THRESHOLD_MS}ms)`,
    );
  if (rushedSegments.length > 0)
    issues.push(
      `${rushedSegments.length} rushed word(s) detected (<${RUSHED_WORD_MIN_MS}ms)`,
    );

  let interpretation: string;
  if (issues.length === 0) {
    interpretation = "Pacing appears natural";
  } else if (issues.length <= 2) {
    interpretation = "Minor pacing issues";
  } else {
    interpretation = "Significant pacing problems";
  }

  return {
    speaking_rate_wpm: Math.round(wpm),
    total_words: totalWords,
    duration_s: Math.round(durationS * 100) / 100,
    long_pauses: longPauses,
    rushed_segments: rushedSegments,
    interpretation,
    issues,
  };
}
