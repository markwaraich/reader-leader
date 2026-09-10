const baseUrl = process.env.READER_LEADER_BASE_URL ?? "http://127.0.0.1:3000";
const targetText = "The big cat sat on the mat.";
const words = targetText.split(/\s+/);
const tokens = words.map((token, index) => ({
  id: `gemini-live-${index}`,
  token,
  normalizedToken: token.toLowerCase().replace(/[^a-z']/g, ""),
  index,
  status: "correct",
  heardAs: token.toLowerCase().replace(/[^a-z']/g, ""),
  confidence: 0.96,
  scoreImpact: false,
}));
const telemetry = {
  version: 1,
  sessionId: "gemini-live-stage4",
  storyId: "fat-cat",
  targetText,
  localeProfile: "en-IE",
  evaluationMode: "regional-restraint",
  status: "complete",
  elapsedMs: 30_000,
  currentTokenIndex: words.length - 1,
  recognitionSupport: "available",
  interimTranscript: "",
  finalTranscript: "the big cat sat on the mat",
  observations: [{ id: "live-observation", resultIndex: 0, transcript: "the big cat sat on the mat", alternatives: [{ transcript: "the big cat sat on the mat", confidence: 0.96 }], confidence: 0.96, isFinal: true, atMs: 25_000 }],
  events: [],
  tokens,
  metrics: { accuracyRate: 100, wcpm: 14, elapsedSeconds: 30, falseCorrectionRate: 0, totalWords: 7, correctWords: 7, substitutions: 0, omissions: 0, selfCorrections: 0, interventions: 0 },
};
const response = await fetch(`${baseUrl}/api/speech/align`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ version: 1, sessionId: telemetry.sessionId, storyId: telemetry.storyId, localeProfile: telemetry.localeProfile, evaluationMode: telemetry.evaluationMode, elapsedMs: telemetry.elapsedMs, telemetry }),
});
const body = await response.json();
if (!response.ok) throw new Error(`Stage 4 Gemini smoke request failed: ${response.status} ${JSON.stringify(body)}`);
if (response.headers.get("x-reader-leader-alignment-source") !== "gemini") throw new Error(`Expected Gemini source, received ${response.headers.get("x-reader-leader-alignment-source")}`);
if (body.tokens?.length !== words.length || body.metrics?.accuracyRate !== 100) throw new Error(`Unexpected running record: ${JSON.stringify(body)}`);
console.log(JSON.stringify({ source: body.source, tokenCount: body.tokens.length, accuracyRate: body.metrics.accuracyRate }));
