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
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    evaluateAudioWithGemini.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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
      scoreImpact: false,
    });
  });
});
