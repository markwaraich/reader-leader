import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { evaluateAudioWithGemini } = vi.hoisted(() => ({
  evaluateAudioWithGemini: vi.fn(),
}));

vi.mock("@/lib/server/gemini-audio-diagnostic", () => ({
  evaluateAudioWithGemini,
}));

import { POST } from "@/app/api/speech/align/route";

const requestBody = {
  sessionId: "session-route-fallback",
  storyId: "brave-knight",
  targetText: "The brave knight went out into the cold night to find his lost horse.",
  localeProfile: "en-IE",
  evaluationMode: "regional-restraint",
  elapsedMs: 20_000,
  isFinal: true,
  currentTokenIndex: 13,
  audioBytes: 44,
  targetToken: "knight",
  audioBase64: "UklGRgAAAAAXQVZF",
  audioMimeType: "audio/wav",
  demoAttempt: "sounded-silent-k",
};

describe("POST /api/speech/align", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.6-flash");
    evaluateAudioWithGemini.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps fluent Standard RP knight correct while evaluating horse independently", async () => {
    evaluateAudioWithGemini
      .mockResolvedValueOnce({
        targetToken: "knight",
        spokenPhonemes: "/n-aɪ-t/",
        status: "fluent",
        errorType: "none",
        restraintApplied: false,
        diagnosticReasoning: "The initial k was silent.",
      })
      .mockResolvedValueOnce({
        targetToken: "horse",
        spokenPhonemes: "/haʊs/",
        status: "misread",
        errorType: "substitution",
        restraintApplied: false,
        diagnosticReasoning: "The target was replaced with house.",
      });

    const response = await POST(new Request("http://localhost/api/speech/align", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...requestBody,
        localeProfile: "en-GB",
        evaluationMode: "standard-rp",
        audioEvidence: [
          { targetToken: "knight", audioBase64: "UklGRgAAAAAXQVZF", audioMimeType: "audio/wav", audioBytes: 44 },
          { targetToken: "horse", audioBase64: "UklGRgAAAAAXQVZF", audioMimeType: "audio/wav", audioBytes: 44 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.headers.get("X-Reader-Leader-Alignment-Source")).toBe("gemini");
    expect(evaluateAudioWithGemini).toHaveBeenCalledTimes(2);
    expect(body.tokens.find((token: { token: string }) => token.token === "knight")).toMatchObject({ status: "correct", scoreImpact: false, phoneticDisplay: "/n-aɪ-t/" });
    expect(body.tokens.find((token: { token: string }) => token.token.startsWith("horse"))).toMatchObject({ status: "substitution", scoreImpact: true, phoneticDisplay: "/haʊs/" });
  });

  it("returns deterministic HTTP 200 output when Gemini fails", async () => {
    evaluateAudioWithGemini.mockRejectedValueOnce(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(new Request("http://localhost/api/speech/align", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Reader-Leader-Alignment-Source")).toBe("deterministic");
    expect(evaluateAudioWithGemini).toHaveBeenCalledOnce();
    expect(body.tokens[2]).toMatchObject({
      token: "knight",
      status: "review",
      phoneticDisplay: "/k-n-aɪ-t/",
      scoreImpact: true,
    });
    expect(body.metrics.accuracyRate).toBe(93);
  });
});
