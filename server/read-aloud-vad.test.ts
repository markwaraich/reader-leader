import { describe, expect, it } from "vitest";
import { HESITATION_THRESHOLD_MS, hesitationReducer, INITIAL_HESITATION_MACHINE, PROMPT_THRESHOLD_MS } from "@/lib/hesitation-fsm";
import { calculateRms, deriveVadThreshold, isVoiceActive, VAD_MAX_THRESHOLD, VAD_MIN_THRESHOLD } from "@/lib/read-aloud/vad";

describe("Stage 4 adaptive VAD", () => {
  it("calculates RMS and clamps a quiet noise floor", () => {
    expect(calculateRms(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(deriveVadThreshold([0.001, 0.002, 0.003])).toBe(VAD_MIN_THRESHOLD);
    expect(deriveVadThreshold([0.2, 0.3, 0.4])).toBe(VAD_MAX_THRESHOLD);
  });

  it("uses a lower release threshold to avoid voice flapping", () => {
    expect(isVoiceActive(0.025, 0.03, false)).toBe(false);
    expect(isVoiceActive(0.025, 0.03, true)).toBe(true);
  });

  it("transitions at exactly three and five seconds and resets on speech", () => {
    expect(HESITATION_THRESHOLD_MS).toBe(3_000);
    expect(PROMPT_THRESHOLD_MS).toBe(5_000);
    let state = hesitationReducer(INITIAL_HESITATION_MACHINE, { type: "PERMISSION_GRANTED", atMs: 0 });
    state = hesitationReducer(state, { type: "SILENCE", atMs: 2_999 });
    expect(state.phase).toBe("listening");
    state = hesitationReducer(state, { type: "SILENCE", atMs: 3_000 });
    expect(state.phase).toBe("hesitating");
    state = hesitationReducer(state, { type: "SILENCE", atMs: 4_999 });
    expect(state.phase).toBe("hesitating");
    state = hesitationReducer(state, { type: "SILENCE", atMs: 5_000 });
    expect(state.phase).toBe("prompting");
    state = hesitationReducer(state, { type: "SPEECH", atMs: 5_100 });
    expect(state).toMatchObject({ phase: "speaking", silenceMs: 0 });
  });
});
