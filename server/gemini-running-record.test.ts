import { describe, expect, it } from "vitest";
import { alignTranscript } from "@/lib/read-aloud/alignment-engine";
import { calculateStage4Metrics } from "@/lib/read-aloud/scoring";
import { reconcileGeminiRunningRecord } from "@/lib/server/running-record-policy";
import type { FinalizeRunningRecordRequest } from "@/lib/domain";

function requestFor(targetText: string, transcript: string): FinalizeRunningRecordRequest {
  const aligned = alignTranscript({ sessionId: "policy-test", targetText, transcript, localeProfile: "en-IE", evaluationMode: "regional-restraint", finalize: true });
  return {
    version: 1,
    sessionId: "policy-test",
    storyId: "fat-cat",
    localeProfile: "en-IE",
    evaluationMode: "regional-restraint",
    elapsedMs: 30_000,
    telemetry: {
      version: 1,
      sessionId: "policy-test",
      storyId: "fat-cat",
      targetText,
      localeProfile: "en-IE",
      evaluationMode: "regional-restraint",
      status: "complete",
      elapsedMs: 30_000,
      currentTokenIndex: aligned.currentTokenIndex,
      recognitionSupport: "available",
      interimTranscript: "",
      finalTranscript: transcript,
      observations: [],
      events: [],
      tokens: aligned.tokens,
      metrics: calculateStage4Metrics(aligned.tokens, 30_000),
    },
  };
}

function geminiTokens(targetText: string) {
  return targetText.split(/\s+/).map((token, index) => ({ index, token, status: "correct" as const, errorType: "none" as const, heardAs: token.toLowerCase().replace(/[^a-z']/g, ""), phoneticDisplay: "", confidence: 0.9, explanation: "Evidence matched.", cueRecommendation: "", falseCorrection: false }));
}

describe("Gemini running-record policy", () => {
  it("enforces a tested rhotic phoneme as an accepted regional variant", () => {
    const targetText = "The horse.";
    const request = requestFor(targetText, "the horse");
    const candidates = geminiTokens(targetText);
    candidates[1] = { ...candidates[1], status: "substitution", errorType: "substitution", phoneticDisplay: "/hɔːɹs/", explanation: "Rhotic r audible." };
    const result = reconcileGeminiRunningRecord(request, targetText, { tokens: candidates, summary: "Regional reading." });
    expect(result.tokens[1]).toMatchObject({ status: "accepted-regional-variant", scoreImpact: false, falseCorrection: false });
    expect(result.metrics.accuracyRate).toBe(100);
  });

  it("preserves a client-observed self-correction even when model output is punitive", () => {
    const targetText = "The cat sat.";
    const request = requestFor(targetText, "the cap cat sat");
    const candidates = geminiTokens(targetText);
    candidates[1] = { ...candidates[1], status: "substitution", errorType: "substitution", heardAs: "cap", explanation: "Initial attempt was cap." };
    const result = reconcileGeminiRunningRecord(request, targetText, { tokens: candidates, summary: "Self correction." });
    expect(result.tokens[1]).toMatchObject({ status: "self-corrected", scoreImpact: false });
    expect(result.metrics.selfCorrections).toBe(1);
  });
});
