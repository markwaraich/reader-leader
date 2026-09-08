import { describe, expect, it } from "vitest";
import { buildDeterministicAlignment } from "@/lib/server/deterministic-alignment";
import { enforceReaderLeaderDiagnosticPolicy } from "@/lib/server/gemini-diagnostic-policy";
import { applyGeminiDiagnosticToAlignment } from "@/lib/server/gemini-alignment-mapper";
import type { AlignmentRequest } from "@/lib/domain";

const request: AlignmentRequest = {
  sessionId: "session-gemini-test",
  storyId: "brave-knight",
  targetText: "The brave knight went out into the cold night to find his lost horse.",
  localeProfile: "en-IE",
  evaluationMode: "regional-restraint",
  elapsedMs: 20_000,
  isFinal: true,
  demoAttempt: "sounded-silent-k",
};

describe("Gemini diagnostic policy", () => {
  it("keeps Standard RP knight correct unless its own audio contains a sounded silent k", () => {
    const standardRequest: AlignmentRequest = {
      ...request,
      localeProfile: "en-GB",
      evaluationMode: "standard-rp",
    };
    const fallback = buildDeterministicAlignment(standardRequest);
    const fluent = applyGeminiDiagnosticToAlignment(fallback, {
      targetToken: "knight",
      spokenPhonemes: "/n-aɪ-t/",
      status: "fluent",
      errorType: "none",
      restraintApplied: false,
      diagnosticReasoning: "The initial k was silent and the word was read fluently.",
    }, "knight");

    expect(fallback.tokens.find((token) => token.token === "knight")).toMatchObject({ status: "correct", scoreImpact: false });
    expect(fluent.tokens.find((token) => token.token === "knight")).toMatchObject({ status: "correct", scoreImpact: false, phoneticDisplay: "/n-aɪ-t/" });
  });

  it("forces a sounded silent k into score-impacting provisional educator review", () => {
    const diagnostic = enforceReaderLeaderDiagnosticPolicy({
      targetToken: "knight",
      spokenPhonemes: "/k-n-aɪ-t/",
      status: "fluent",
      errorType: "none",
      restraintApplied: true,
      diagnosticReasoning: "Model initially accepted the attempt.",
    }, "knight", "Hiberno-English / Northern Irish");

    const alignment = applyGeminiDiagnosticToAlignment(
      buildDeterministicAlignment(request),
      diagnostic,
      "knight",
    );
    const knight = alignment.tokens.find((token) => token.token === "knight");

    expect(diagnostic).toMatchObject({
      status: "misread",
      errorType: "grapheme-confusion",
      restraintApplied: false,
    });
    expect(knight).toMatchObject({ status: "review", scoreImpact: true, phoneticDisplay: "/k-n-aɪ-t/" });
    expect(alignment.metrics.accuracyRate).toBe(93);
  });

  it("accepts regional rhotic horse with zero score impact", () => {
    const diagnostic = enforceReaderLeaderDiagnosticPolicy({
      targetToken: "horse",
      spokenPhonemes: "/hɔːɹs/",
      status: "misread",
      errorType: "substitution",
      restraintApplied: false,
      diagnosticReasoning: "A rhotic r was audible.",
    }, "horse", "Hiberno-English / Northern Irish");

    const alignment = applyGeminiDiagnosticToAlignment(
      buildDeterministicAlignment(request),
      diagnostic,
      "horse",
    );
    const horse = alignment.tokens.find((token) => token.token.startsWith("horse"));

    expect(horse).toMatchObject({ status: "accepted-regional-variant", scoreImpact: false, falseCorrection: false });
    expect(alignment.metrics.falseCorrectionRate).toBe(0);
  });
});
