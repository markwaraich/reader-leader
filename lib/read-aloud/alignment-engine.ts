import type { AccentProfile, EvaluationMode, LiveTokenState } from "@/lib/domain";
import { findAccentInvariant } from "@/lib/read-aloud/accent-invariance";
import { targetTokens, tokenizeTranscript } from "@/lib/read-aloud/transcript-normalization";

export const MAX_ALIGNMENT_LOOKAHEAD = 4 as const;

export interface AlignmentEngineInput {
  sessionId: string;
  targetText: string;
  transcript: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  confidence?: number;
  finalize?: boolean;
}

export interface AlignmentEngineResult {
  tokens: LiveTokenState[];
  currentTokenIndex: number;
}

function pendingTokens(sessionId: string, text: string): LiveTokenState[] {
  return targetTokens(text).map(({ token, normalizedToken, index }) => ({
    id: `${sessionId}-${index}`,
    token,
    normalizedToken,
    index,
    status: "pending",
    scoreImpact: false,
  }));
}

function isExact(expected: string, observed: string): boolean {
  return expected === observed;
}

export function alignTranscript(input: AlignmentEngineInput): AlignmentEngineResult {
  const tokens = pendingTokens(input.sessionId, input.targetText);
  const observed = tokenizeTranscript(input.transcript);
  let targetIndex = 0;
  let observedIndex = 0;

  const commitMatch = (index: number, word: string) => {
    const token = tokens[index];
    const accent = findAccentInvariant({
      expected: token.normalizedToken,
      observed: word,
      localeProfile: input.localeProfile,
      evaluationMode: input.evaluationMode,
    });
    tokens[index] = {
      ...token,
      status: accent ? "accepted-regional-variant" : "correct",
      heardAs: word,
      confidence: input.confidence,
      explanation: accent?.explanation,
      scoreImpact: false,
    };
  };

  while (targetIndex < tokens.length && observedIndex < observed.length) {
    const expected = tokens[targetIndex].normalizedToken;
    const heard = observed[observedIndex];
    const accent = findAccentInvariant({
      expected,
      observed: heard,
      localeProfile: input.localeProfile,
      evaluationMode: input.evaluationMode,
    });

    if (isExact(expected, heard) || accent) {
      commitMatch(targetIndex, heard);
      targetIndex += 1;
      observedIndex += 1;
      continue;
    }

    const targetLookaheadEnd = Math.min(tokens.length, targetIndex + MAX_ALIGNMENT_LOOKAHEAD + 1);
    const skippedToTarget = tokens
      .slice(targetIndex + 1, targetLookaheadEnd)
      .findIndex((token) => isExact(token.normalizedToken, heard) || Boolean(findAccentInvariant({
        expected: token.normalizedToken,
        observed: heard,
        localeProfile: input.localeProfile,
        evaluationMode: input.evaluationMode,
      })));

    if (skippedToTarget >= 0) {
      const matchedTargetIndex = targetIndex + skippedToTarget + 1;
      for (let index = targetIndex; index < matchedTargetIndex; index += 1) {
        tokens[index] = {
          ...tokens[index],
          status: "omission",
          explanation: "Target word was skipped in the final recognition sequence.",
          scoreImpact: true,
        };
      }
      targetIndex = matchedTargetIndex;
      commitMatch(targetIndex, heard);
      targetIndex += 1;
      observedIndex += 1;
      continue;
    }

    const observedLookaheadEnd = Math.min(observed.length, observedIndex + MAX_ALIGNMENT_LOOKAHEAD + 1);
    const correctionOffset = observed
      .slice(observedIndex + 1, observedLookaheadEnd)
      .findIndex((candidate) => isExact(expected, candidate) || Boolean(findAccentInvariant({
        expected,
        observed: candidate,
        localeProfile: input.localeProfile,
        evaluationMode: input.evaluationMode,
      })));

    if (correctionOffset >= 0) {
      const correctedWordIndex = observedIndex + correctionOffset + 1;
      const correctedWord = observed[correctedWordIndex];
      const correctionAccent = findAccentInvariant({
        expected,
        observed: correctedWord,
        localeProfile: input.localeProfile,
        evaluationMode: input.evaluationMode,
      });
      tokens[targetIndex] = {
        ...tokens[targetIndex],
        status: "self-corrected",
        firstAttempt: heard,
        heardAs: correctedWord,
        confidence: input.confidence,
        explanation: correctionAccent?.explanation ?? `Self-corrected from “${heard}” to “${correctedWord}”.`,
        scoreImpact: false,
      };
      targetIndex += 1;
      observedIndex = correctedWordIndex + 1;
      continue;
    }

    tokens[targetIndex] = {
      ...tokens[targetIndex],
      status: "substitution",
      heardAs: heard,
      confidence: input.confidence,
      explanation: `Recognized “${heard}” instead of “${expected}”.`,
      scoreImpact: true,
    };
    targetIndex += 1;
    observedIndex += 1;
  }

  if (input.finalize) {
    for (let index = targetIndex; index < tokens.length; index += 1) {
      tokens[index] = {
        ...tokens[index],
        status: "omission",
        explanation: "No final recognition result matched this target word.",
        scoreImpact: true,
      };
    }
  }

  const firstPending = tokens.findIndex((token) => token.status === "pending");
  return {
    tokens,
    currentTokenIndex: firstPending >= 0 ? firstPending : Math.max(0, tokens.length - 1),
  };
}
