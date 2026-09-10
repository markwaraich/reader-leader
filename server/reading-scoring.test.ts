import { describe, expect, it } from "vitest";
import { calculateStage4Metrics } from "@/lib/read-aloud/scoring";
import type { LiveTokenState } from "@/lib/domain";

function token(index: number, status: LiveTokenState["status"], scoreImpact: boolean): LiveTokenState {
  return { id: `t-${index}`, token: `word-${index}`, normalizedToken: `word${index}`, index, status, scoreImpact };
}

describe("Stage 4 scoring", () => {
  it("counts only unresolved substitutions and omissions as accuracy errors", () => {
    const metrics = calculateStage4Metrics([
      token(0, "correct", false),
      token(1, "substitution", true),
      token(2, "omission", true),
      token(3, "self-corrected", false),
      token(4, "accepted-regional-variant", false),
    ], 60_000, 2);
    expect(metrics).toMatchObject({
      totalWords: 5,
      correctWords: 3,
      accuracyRate: 60,
      wcpm: 3,
      substitutions: 1,
      omissions: 1,
      selfCorrections: 1,
      interventions: 2,
    });
  });

  it("uses a one-second floor for zero-duration safety", () => {
    const metrics = calculateStage4Metrics([token(0, "correct", false)], 0);
    expect(metrics.elapsedSeconds).toBe(1);
    expect(metrics.wcpm).toBe(60);
  });
});
