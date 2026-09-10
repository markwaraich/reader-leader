import { describe, expect, it } from "vitest";
import { createReadAloudStore } from "@/lib/read-aloud/telemetry-store";

const session = {
  sessionId: "store-session",
  storyId: "fat-cat" as const,
  targetText: "The big cat sat on the mat.",
  localeProfile: "en-IE" as const,
  evaluationMode: "regional-restraint" as const,
  recognitionSupport: "available" as const,
};

describe("Stage 4 telemetry store", () => {
  it("aligns final observations and computes a completed snapshot", () => {
    const store = createReadAloudStore();
    store.getState().startSession(session);
    store.getState().ingestObservation({
      id: "observation-1",
      resultIndex: 0,
      transcript: "the big cap cat sat on the mat",
      alternatives: [{ transcript: "the big cap cat sat on the mat", confidence: 0.91 }],
      confidence: 0.91,
      isFinal: true,
      atMs: 1_500,
    });
    store.getState().recordEvent("intervention", 5_000, "support offered");
    const completed = store.getState().finalize(30_000);
    expect(completed?.tokens[2]).toMatchObject({ status: "self-corrected", firstAttempt: "cap" });
    expect(completed?.metrics).toMatchObject({ accuracyRate: 100, selfCorrections: 1, interventions: 1 });
    expect(completed?.status).toBe("complete");
  });

  it("bounds event history and contains only serializable data", () => {
    const store = createReadAloudStore();
    store.getState().startSession(session);
    for (let index = 0; index < 520; index += 1) store.getState().recordEvent("speech-start", index);
    const telemetry = store.getState().telemetry;
    expect(telemetry?.events).toHaveLength(500);
    expect(() => JSON.stringify(telemetry)).not.toThrow();
    expect(JSON.stringify(telemetry)).not.toContain("Blob");
  });

  it("resets cleanly between stories", () => {
    const store = createReadAloudStore();
    store.getState().startSession(session);
    store.getState().reset();
    expect(store.getState().telemetry).toBeNull();
  });
});
