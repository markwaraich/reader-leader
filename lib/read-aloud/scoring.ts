import type { LiveTokenState, ReadingMetrics, TokenAlignment } from "@/lib/domain";

type ScoredToken = Pick<LiveTokenState | TokenAlignment, "status" | "scoreImpact" | "falseCorrection">;

export function calculateStage4Metrics(tokens: ScoredToken[], elapsedMs: number, interventions = 0): ReadingMetrics {
  const totalWords = tokens.length;
  const scoredTotal = Math.max(totalWords, 1);
  const correctWords = tokens.filter((token) => !token.scoreImpact && token.status !== "pending").length;
  const substitutions = tokens.filter((token) => token.status === "substitution" || token.status === "confirmed-misread").length;
  const omissions = tokens.filter((token) => token.status === "omission").length;
  const selfCorrections = tokens.filter((token) => token.status === "self-corrected").length;
  const falseCorrections = tokens.filter((token) => token.falseCorrection).length;
  const elapsedSeconds = Math.max(Math.round(elapsedMs / 1_000), 1);
  const minutes = Math.max(elapsedMs / 60_000, 1 / 60);

  return {
    accuracyRate: Math.round((correctWords / scoredTotal) * 100),
    wcpm: Math.round(correctWords / minutes),
    elapsedSeconds,
    falseCorrectionRate: Number(((falseCorrections / scoredTotal) * 100).toFixed(1)),
    totalWords,
    correctWords,
    substitutions,
    omissions,
    selfCorrections,
    interventions,
  };
}
