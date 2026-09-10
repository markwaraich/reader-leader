import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alignTranscript } from "@/lib/read-aloud/alignment-engine";
import { calculateStage4Metrics } from "@/lib/read-aloud/scoring";
import { getStory } from "@/lib/seed";

const { evaluateRunningRecordWithGemini } = vi.hoisted(() => ({ evaluateRunningRecordWithGemini: vi.fn() }));
vi.mock("@/lib/server/gemini-running-record", () => ({ evaluateRunningRecordWithGemini }));

import { POST } from "@/app/api/speech/align/route";

const story = getStory("fat-cat");
const aligned = alignTranscript({
  sessionId: "stage4-route",
  targetText: story.targetText,
  transcript: "the big cat sat on the mat",
  localeProfile: "en-IE",
  evaluationMode: "regional-restraint",
  finalize: true,
});
const telemetry = {
  version: 1 as const,
  sessionId: "stage4-route",
  storyId: "fat-cat" as const,
  targetText: story.targetText,
  localeProfile: "en-IE" as const,
  evaluationMode: "regional-restraint" as const,
  status: "complete" as const,
  elapsedMs: 30_000,
  currentTokenIndex: aligned.currentTokenIndex,
  recognitionSupport: "available" as const,
  interimTranscript: "",
  finalTranscript: "the big cat sat on the mat",
  observations: [],
  events: [{ id: "nudge-1", type: "visual-nudge" as const, atMs: 3_000, tokenIndex: 2, detail: "nudge only" }],
  tokens: aligned.tokens,
  metrics: calculateStage4Metrics(aligned.tokens, 30_000),
};
const requestBody = {
  version: 1 as const,
  sessionId: telemetry.sessionId,
  storyId: telemetry.storyId,
  localeProfile: telemetry.localeProfile,
  evaluationMode: telemetry.evaluationMode,
  elapsedMs: telemetry.elapsedMs,
  telemetry,
};

function request(body: unknown) {
  return new Request("http://localhost/api/speech/align", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function geminiTokens() {
  return story.targetText.split(/\s+/).map((token, index) => ({
    index,
    token,
    status: "correct" as const,
    errorType: "none" as const,
    heardAs: token.toLowerCase().replace(/[^a-z']/g, ""),
    phoneticDisplay: "",
    confidence: 0.95,
    explanation: "Matched the final recognition evidence.",
    cueRecommendation: "",
    falseCorrection: false,
  }));
}

describe("POST /api/speech/align", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.6-flash");
    evaluateRunningRecordWithGemini.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a policy-checked Gemini record with deterministic scores", async () => {
    evaluateRunningRecordWithGemini.mockResolvedValue({ tokens: geminiTokens(), summary: "Fluent reading." });
    const response = await POST(request(requestBody));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Reader-Leader-Alignment-Source")).toBe("gemini");
    expect(evaluateRunningRecordWithGemini).toHaveBeenCalledOnce();
    expect(body).toMatchObject({ source: "gemini", metrics: { accuracyRate: 100, correctWords: 7, substitutions: 0, omissions: 0 } });
  });

  it("does not turn a silence nudge into an unsupported omission", async () => {
    const tokens = geminiTokens();
    tokens[2] = { ...tokens[2], status: "omission", errorType: "omission", heardAs: "", explanation: "The child paused." };
    evaluateRunningRecordWithGemini.mockResolvedValue({ tokens, summary: "Pause detected." });
    const response = await POST(request(requestBody));
    const body = await response.json();
    expect(body.tokens[2]).toMatchObject({ status: "correct", scoreImpact: false });
    expect(body.metrics.accuracyRate).toBe(100);
  });

  it("returns validated client alignment when Gemini output violates canonical order", async () => {
    evaluateRunningRecordWithGemini.mockResolvedValue({ tokens: geminiTokens().slice(0, -1), summary: "Incomplete." });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request(requestBody));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Reader-Leader-Alignment-Source")).toBe("client-fallback");
    expect(body).toMatchObject({ source: "client-fallback", metrics: { accuracyRate: 100 } });
    expect(body.warning).toContain("validated client alignment");
  });

  it("returns client fallback when the API key is absent", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await POST(request(requestBody));
    const body = await response.json();
    expect(response.headers.get("X-Reader-Leader-Alignment-Source")).toBe("client-fallback");
    expect(evaluateRunningRecordWithGemini).not.toHaveBeenCalled();
    expect(body.warning).toContain("not configured");
  });

  it("rejects inconsistent and oversized telemetry", async () => {
    const inconsistent = await POST(request({ ...requestBody, storyId: "big-dog" }));
    expect(inconsistent.status).toBe(400);
    const oversized = await POST(request({ ...requestBody, telemetry: { ...telemetry, finalTranscript: "x".repeat(20_001) } }));
    expect(oversized.status).toBe(400);
  });
});
