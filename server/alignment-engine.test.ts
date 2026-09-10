import { describe, expect, it } from "vitest";
import { alignTranscript, MAX_ALIGNMENT_LOOKAHEAD } from "@/lib/read-aloud/alignment-engine";

const base = {
  sessionId: "stage4-test",
  localeProfile: "en-IE" as const,
  evaluationMode: "regional-restraint" as const,
};

describe("bounded Stage 4 alignment", () => {
  it("aligns multiword final results without speech-burst progression", () => {
    const result = alignTranscript({ ...base, targetText: "The brave knight went", transcript: "the brave knight went" });
    expect(result.tokens.map((token) => token.status)).toEqual(["correct", "correct", "correct", "correct"]);
    expect(result.currentTokenIndex).toBe(3);
  });

  it("records a skipped phrase as omissions within the four-token lookahead", () => {
    expect(MAX_ALIGNMENT_LOOKAHEAD).toBe(4);
    const result = alignTranscript({ ...base, targetText: "one two three four five six", transcript: "one five six", finalize: true });
    expect(result.tokens.map((token) => token.status)).toEqual(["correct", "omission", "omission", "omission", "correct", "correct"]);
  });

  it("does not jump beyond the four-token lookahead", () => {
    const result = alignTranscript({ ...base, targetText: "one two three four five six seven", transcript: "one seven", finalize: true });
    expect(result.tokens[1]).toMatchObject({ status: "substitution", heardAs: "seven" });
    expect(result.tokens.slice(2).every((token) => token.status === "omission")).toBe(true);
  });

  it("records a wrong attempt followed by the target as a self-correction", () => {
    const result = alignTranscript({ ...base, targetText: "the cat sat", transcript: "the cap cat sat", finalize: true });
    expect(result.tokens[1]).toMatchObject({ status: "self-corrected", firstAttempt: "cap", heardAs: "cat", scoreImpact: false });
  });

  it("accepts tested regional fixtures before substitution scoring", () => {
    const restrained = alignTranscript({ ...base, targetText: "three horse", transcript: "tree hoarse", finalize: true });
    expect(restrained.tokens.map((token) => token.status)).toEqual(["accepted-regional-variant", "accepted-regional-variant"]);

    const baseline = alignTranscript({ ...base, localeProfile: "en-GB", evaluationMode: "standard-rp", targetText: "three horse", transcript: "tree hoarse", finalize: true });
    expect(baseline.tokens.map((token) => token.status)).toEqual(["substitution", "substitution"]);
  });

  it("keeps unresolved target words pending until finalization", () => {
    const live = alignTranscript({ ...base, targetText: "the cat sat", transcript: "the" });
    expect(live.tokens.map((token) => token.status)).toEqual(["correct", "pending", "pending"]);
    const final = alignTranscript({ ...base, targetText: "the cat sat", transcript: "the", finalize: true });
    expect(final.tokens.map((token) => token.status)).toEqual(["correct", "omission", "omission"]);
  });
});
