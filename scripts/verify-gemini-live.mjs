import { readFile } from "node:fs/promises";

const baseUrl = process.env.READER_LEADER_BASE_URL ?? "http://127.0.0.1:3000";
const wavPath = process.env.READER_LEADER_WAV_FIXTURE ?? "/tmp/reader-leader-gemini-smoke.wav";
const audioBase64 = (await readFile(wavPath)).toString("base64");

const baseRequest = {
  sessionId: "session-gemini-live-smoke",
  storyId: "brave-knight",
  targetText: "The brave knight went out into the cold night to find his lost horse.",
  localeProfile: "en-IE",
  evaluationMode: "regional-restraint",
  elapsedMs: 20_000,
  isFinal: true,
  currentTokenIndex: 13,
  demoAttempt: "sounded-silent-k",
};

async function post(body) {
  const response = await fetch(`${baseUrl}/api/speech/align`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Alignment endpoint returned ${response.status}.`);
  return {
    source: response.headers.get("x-reader-leader-alignment-source"),
    body: await response.json(),
  };
}

const live = await post({
  ...baseRequest,
  targetToken: "knight",
  audioBytes: Math.ceil(audioBase64.length * 0.75),
  audioBase64,
  audioMimeType: "audio/wav",
});
if (live.source !== "gemini") {
  throw new Error(`Expected live Gemini alignment, received ${live.source ?? "no source header"}.`);
}

const fallback = await post(baseRequest);
if (fallback.source !== "deterministic") {
  throw new Error(`Expected deterministic fallback, received ${fallback.source ?? "no source header"}.`);
}

const target = live.body.tokens?.find((token) => token.token === "knight");
if (!target?.explanation || !target?.phoneticDisplay) {
  throw new Error("Live Gemini response did not populate the target token evidence.");
}

console.log(`Gemini live alignment passed (${target.status}); deterministic fallback also returned HTTP 200.`);
