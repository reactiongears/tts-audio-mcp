export interface TextDiffResult {
  expected: string;
  got: string;
  wer: number;
  substitutions: Array<{ expected: string; got: string; position: number }>;
  insertions: Array<{ word: string; position: number }>;
  deletions: Array<{ word: string; position: number }>;
  summary: string;
}

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

// Compute edit distance with backtrace for alignment
function levenshteinAlign(
  ref: string[],
  hyp: string[],
): { substitutions: number; insertions: number; deletions: number; ops: Array<{ type: "match" | "sub" | "ins" | "del"; ref?: string; hyp?: string; refIdx: number; hypIdx: number }> } {
  const n = ref.length;
  const m = hyp.length;

  // DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0),
  );

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrace
  const ops: Array<{
    type: "match" | "sub" | "ins" | "del";
    ref?: string;
    hyp?: string;
    refIdx: number;
    hypIdx: number;
  }> = [];

  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1]) {
      ops.unshift({ type: "match", ref: ref[i - 1], hyp: hyp[j - 1], refIdx: i - 1, hypIdx: j - 1 });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.unshift({ type: "sub", ref: ref[i - 1], hyp: hyp[j - 1], refIdx: i - 1, hypIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.unshift({ type: "ins", hyp: hyp[j - 1], refIdx: i, hypIdx: j - 1 });
      j--;
    } else {
      ops.unshift({ type: "del", ref: ref[i - 1], refIdx: i - 1, hypIdx: j });
      i--;
    }
  }

  let substitutions = 0;
  let insertions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.type === "sub") substitutions++;
    if (op.type === "ins") insertions++;
    if (op.type === "del") deletions++;
  }

  return { substitutions, insertions, deletions, ops };
}

export function compareTexts(
  expected: string,
  transcribed: string,
): TextDiffResult {
  const refWords = normalizeText(expected);
  const hypWords = normalizeText(transcribed);

  const alignment = levenshteinAlign(refWords, hypWords);
  const totalRef = refWords.length || 1;
  const wer =
    (alignment.substitutions + alignment.insertions + alignment.deletions) /
    totalRef;

  const substitutions: TextDiffResult["substitutions"] = [];
  const insertions: TextDiffResult["insertions"] = [];
  const deletions: TextDiffResult["deletions"] = [];

  for (const op of alignment.ops) {
    if (op.type === "sub") {
      substitutions.push({
        expected: op.ref ?? "",
        got: op.hyp ?? "",
        position: op.refIdx,
      });
    } else if (op.type === "ins") {
      insertions.push({ word: op.hyp ?? "", position: op.hypIdx });
    } else if (op.type === "del") {
      deletions.push({ word: op.ref ?? "", position: op.refIdx });
    }
  }

  const errorCount =
    substitutions.length + insertions.length + deletions.length;
  const summary =
    errorCount === 0
      ? "Perfect match — no mispronunciations detected"
      : `${errorCount} error(s): ${substitutions.length} substitution(s), ${insertions.length} insertion(s), ${deletions.length} deletion(s). WER: ${(wer * 100).toFixed(1)}%`;

  return {
    expected,
    got: transcribed,
    wer: Math.round(wer * 1000) / 1000,
    substitutions,
    insertions,
    deletions,
    summary,
  };
}
