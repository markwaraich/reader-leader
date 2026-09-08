import type { AlignmentResponse, GeminiTargetToken, TokenAlignment } from "@/lib/domain";
import { recalculateAlignmentMetrics } from "@/lib/reading-metrics";
import type { GeminiAudioDiagnostic } from "@/lib/server/gemini-diagnostic-policy";

function statusFromDiagnostic(diagnostic: GeminiAudioDiagnostic): TokenAlignment["status"] {
  if (diagnostic.status === "fluent") return "correct";
  if (diagnostic.status === "accepted-regional-variant") return "accepted-regional-variant";
  if (diagnostic.status === "hesitation") return "hesitation";
  if (diagnostic.errorType === "omission") return "omission";
  if (diagnostic.errorType === "substitution") return "substitution";
  return "review";
}

export function applyGeminiDiagnosticToAlignment(
  alignment: AlignmentResponse,
  diagnostic: GeminiAudioDiagnostic,
  targetToken: GeminiTargetToken,
): AlignmentResponse {
  const targetIndex = alignment.tokens.findIndex(
    (token) => token.token.toLowerCase().replace(/[^a-z']/g, "") === targetToken,
  );
  if (targetIndex < 0) return alignment;

  const status = statusFromDiagnostic(diagnostic);
  const scoreImpact = status === "substitution" || status === "omission" || diagnostic.errorType === "grapheme-confusion";
  const tokens = alignment.tokens.map((token, index) => index === targetIndex ? {
    ...token,
    status,
    heardAs: diagnostic.spokenPhonemes,
    phoneticDisplay: diagnostic.spokenPhonemes,
    explanation: diagnostic.diagnosticReasoning,
    scoreImpact,
    falseCorrection: status === "accepted-regional-variant" ? false : token.falseCorrection,
    cueRecommendation: status === "review"
      ? "Confirm the phonics error or override the AI if the recording was misheard."
      : token.cueRecommendation,
  } : token);

  return recalculateAlignmentMetrics({
    ...alignment,
    restraintApplied: tokens.some((token) => token.status === "accepted-regional-variant"),
    tokens,
  });
}
