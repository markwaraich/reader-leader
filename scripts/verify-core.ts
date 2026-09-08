import assert from "node:assert/strict";
import {
  BASELINE_ASR_PATIENCE_MS,
  BASELINE_AUTO_FINISH_MS,
  HESITATION_THRESHOLD_MS,
  HIBERNO_AUTO_FINISH_MS,
  INITIAL_TOKEN_INDEX,
  INITIAL_HESITATION_MACHINE,
  PROMPT_THRESHOLD_MS,
  advanceTokenIndex,
  hesitationReducer,
  shouldAutoFinishReading,
  shouldShowBaselineInterrupt,
  shouldSuppressFinalHesitation,
} from "../lib/hesitation-fsm.ts";
import { createAttemptSnippetWindow } from "../lib/audio-data.ts";
import { calculateReadingMetrics } from "../lib/reading-metrics.ts";
import type { AlignmentStatus, TokenAlignment } from "../lib/domain.ts";

assert.equal(HESITATION_THRESHOLD_MS, 2_000);
assert.equal(PROMPT_THRESHOLD_MS, 3_800);
assert.equal(BASELINE_ASR_PATIENCE_MS, 800);
assert.equal(HIBERNO_AUTO_FINISH_MS, 1_200);
assert.equal(BASELINE_AUTO_FINISH_MS, 2_400);

let state = hesitationReducer(INITIAL_HESITATION_MACHINE, { type: "PERMISSION_GRANTED", atMs: 0 });
state = hesitationReducer(state, { type: "SILENCE", atMs: HESITATION_THRESHOLD_MS - 1 });
assert.equal(state.phase, "listening");
state = hesitationReducer(state, { type: "SILENCE", atMs: HESITATION_THRESHOLD_MS });
assert.equal(state.phase, "hesitating");
state = hesitationReducer(state, { type: "SILENCE", atMs: PROMPT_THRESHOLD_MS });
assert.equal(state.phase, "prompting");
state = hesitationReducer(state, { type: "SPEECH", atMs: PROMPT_THRESHOLD_MS + 100 });
assert.equal(state.phase, "speaking");
assert.equal(state.silenceMs, 0);
state = hesitationReducer(state, { type: "SILENCE", atMs: PROMPT_THRESHOLD_MS + 200 });
assert.equal(state.phase, "listening");
assert.equal(INITIAL_TOKEN_INDEX, 0);

assert.equal(advanceTokenIndex(0, 14), 1);
assert.equal(advanceTokenIndex(13, 14), 13);
assert.equal(shouldAutoFinishReading(13, 14, true, HIBERNO_AUTO_FINISH_MS - 1, "regional-restraint"), false);
assert.equal(shouldAutoFinishReading(13, 14, true, HIBERNO_AUTO_FINISH_MS, "regional-restraint"), true);
assert.equal(shouldAutoFinishReading(13, 14, true, BASELINE_AUTO_FINISH_MS - 1, "standard-rp"), false);
assert.equal(shouldAutoFinishReading(13, 14, true, BASELINE_AUTO_FINISH_MS, "standard-rp"), true);
assert.equal(shouldSuppressFinalHesitation("regional-restraint", 13, 14), true);
assert.equal(shouldSuppressFinalHesitation("standard-rp", 13, 14), false);
assert.deepEqual(createAttemptSnippetWindow(2_750), { startMs: 2_350, endMs: 4_350, durationMs: 2_000 });
assert.equal(shouldShowBaselineInterrupt("standard-rp", "horse.", true, BASELINE_ASR_PATIENCE_MS - 1), false);
assert.equal(shouldShowBaselineInterrupt("standard-rp", "horse.", true, BASELINE_ASR_PATIENCE_MS), true);
assert.equal(shouldShowBaselineInterrupt("regional-restraint", "horse.", true, BASELINE_ASR_PATIENCE_MS), false);

const statuses: AlignmentStatus[] = ["correct", "substitution", "confirmed-phonics-error", "accepted-teacher-override"];
assert.notEqual(statuses[2], "accepted-regional-variant");
const tokens: TokenAlignment[] = statuses.map((status, index) => ({
  id: `token-${index}`,
  token: `word-${index}`,
  index,
  status,
  confidence: 0.9,
  scoreImpact: status === "substitution" || status === "confirmed-phonics-error",
  falseCorrection: status === "substitution",
}));
const metrics = calculateReadingMetrics(tokens, 60);
assert.equal(metrics.accuracyRate, 50);
assert.equal(metrics.wcpm, 2);
assert.equal(metrics.falseCorrectionRate, 25);

const provisionalKnightTokens: TokenAlignment[] = Array.from({ length: 14 }, (_, index) => ({
  id: `story-token-${index}`,
  token: index === 2 ? "knight" : `word-${index}`,
  index,
  status: index === 2 ? "review" : "correct",
  confidence: 0.9,
  scoreImpact: index === 2,
}));
assert.equal(calculateReadingMetrics(provisionalKnightTokens, 60).accuracyRate, 93);

console.log("Core FSM, metrics, and override-taxonomy checks passed.");
