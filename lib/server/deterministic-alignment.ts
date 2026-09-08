import type { AlignmentRequest, AlignmentResponse, TokenAlignment } from "@/lib/domain";
import { calculateReadingMetrics } from "@/lib/reading-metrics";

export function buildDeterministicAlignment(input: AlignmentRequest): AlignmentResponse {
  const words = input.targetText.trim().split(/\s+/);
  const elapsedSeconds = Math.max(input.elapsedMs / 1_000, 1);
  const tokens: TokenAlignment[] = words.map((token, index) => {
    const normalised = token.toLowerCase().replace(/[^a-z']/g, "");
    if (normalised === "knight" && input.demoAttempt === "sounded-silent-k") {
      return {
        id: `${input.sessionId}-${index}`,
        token,
        index,
        status: "review",
        confidence: 0.86,
        heardAs: "k-night",
        phoneticDisplay: "/k-n-aɪ-t/",
        explanation: "Child sounded out the silent ‘k’ (pronounced as /k-n-aɪ-t/).",
        scoreImpact: true,
        cueRecommendation: "Confirm the phonics error or override the AI if the recording was misheard.",
      };
    }
    if (normalised === "knight") {
      return {
        id: `${input.sessionId}-${index}`,
        token,
        index,
        status: input.evaluationMode === "regional-restraint" ? "accepted-regional-variant" : "correct",
        confidence: 0.99,
        heardAs: "night",
        phoneticDisplay: "/n-aɪ-t/",
        explanation: "Correct reading: the initial ‘k’ is silent.",
        scoreImpact: false,
      };
    }
    if (normalised === "horse" && input.evaluationMode === "regional-restraint") {
      return {
        id: `${input.sessionId}-${index}`,
        token,
        index,
        status: "accepted-regional-variant",
        confidence: 0.97,
        heardAs: "rhotic horse",
        phoneticDisplay: "/hɔːrs/",
        explanation: "Accepted rhotic /r/ in Hiberno-English and Northern Irish speech. Reader Leader stays silent.",
        scoreImpact: false,
      };
    }
    if (normalised === "horse" && input.evaluationMode === "standard-rp") {
      return {
        id: `${input.sessionId}-${index}`,
        token,
        index,
        status: "substitution",
        confidence: 0.72,
        heardAs: "rhotic horse",
        phoneticDisplay: "/hɔːrs/",
        explanation: "Baseline ASR simulated a false correction for the regional rhotic /r/.",
        scoreImpact: true,
        falseCorrection: true,
        cueRecommendation: "Amber interrupt: repeat using the baseline pronunciation model.",
      };
    }
    return {
      id: `${input.sessionId}-${index}`,
      token,
      index,
      status: "correct",
      confidence: 0.98,
      scoreImpact: false,
    };
  });

  return {
    sessionId: input.sessionId,
    localeProfile: input.localeProfile,
    evaluationMode: input.evaluationMode,
    restraintApplied: tokens.some((token) => token.status === "accepted-regional-variant"),
    lastConfirmedTokenIndex: tokens.length - 1,
    tokens,
    metrics: calculateReadingMetrics(tokens, elapsedSeconds),
  };
}
