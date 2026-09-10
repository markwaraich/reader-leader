/** Educator evidence rule: only score-impacting classifications reduce accuracy; accepted AI restraint and teacher overrides remain distinct. */
import type { AlignmentResponse, ReadingMetrics, TokenAlignment } from "@/lib/domain";
import { calculateStage4Metrics } from "./read-aloud/scoring.ts";

export function calculateReadingMetrics(tokens: TokenAlignment[], elapsedSeconds: number, interventions = 0): ReadingMetrics {
  return calculateStage4Metrics(tokens, elapsedSeconds * 1_000, interventions);
}

export function recalculateAlignmentMetrics(alignment: AlignmentResponse): AlignmentResponse {
  return {
    ...alignment,
    metrics: calculateReadingMetrics(alignment.tokens, alignment.metrics.elapsedSeconds, alignment.metrics.interventions),
  };
}
