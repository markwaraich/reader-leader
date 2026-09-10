import type { AlignmentResponse, AlignmentStatus, LiveTokenState, TokenAlignment } from "@/lib/domain";
import { findAccentInvariant } from "@/lib/read-aloud/accent-invariance";
import { calculateStage4Metrics } from "@/lib/read-aloud/scoring";
import { normalizeWord, targetTokens } from "@/lib/read-aloud/transcript-normalization";
import type { GeminiRunningRecord, ValidatedFinalizeRunningRecordRequest } from "@/lib/server/running-record-schema";

function alignmentStatus(status: LiveTokenState["status"]): AlignmentStatus {
  return status === "pending" ? "omission" : status;
}

function hasScoreImpact(status: AlignmentStatus, errorType?: GeminiRunningRecord["tokens"][number]["errorType"]): boolean {
  return status === "substitution" || status === "omission" || status === "confirmed-misread" || status === "confirmed-phonics-error" || (status === "review" && errorType === "grapheme-confusion");
}

function buildResponse(request: ValidatedFinalizeRunningRecordRequest, tokens: TokenAlignment[], source: AlignmentResponse["source"], warning?: string): AlignmentResponse {
  const interventions = request.telemetry.events.filter((event) => event.type === "intervention").length;
  return {
    sessionId: request.sessionId,
    localeProfile: request.localeProfile,
    evaluationMode: request.evaluationMode,
    restraintApplied: tokens.some((token) => token.status === "accepted-regional-variant"),
    lastConfirmedTokenIndex: Math.max(0, tokens.length - 1),
    tokens,
    metrics: calculateStage4Metrics(tokens, request.elapsedMs, interventions),
    source,
    warning,
  };
}

export function buildClientFallbackRecord(request: ValidatedFinalizeRunningRecordRequest, canonicalTargetText: string, warning?: string): AlignmentResponse {
  const canonical = targetTokens(canonicalTargetText);
  const tokens: TokenAlignment[] = canonical.map((target, index) => {
    const client = request.telemetry.tokens[index];
    const status = client ? alignmentStatus(client.status) : "omission";
    return {
      id: `${request.sessionId}-${index}`,
      token: target.token,
      index,
      status,
      confidence: client?.confidence ?? 0,
      heardAs: client?.heardAs,
      explanation: client?.explanation ?? (status === "omission" ? "No final recognition result matched this target word." : undefined),
      scoreImpact: hasScoreImpact(status),
      falseCorrection: client?.falseCorrection,
    };
  });
  return buildResponse(request, tokens, "client-fallback", warning);
}

export function reconcileGeminiRunningRecord(request: ValidatedFinalizeRunningRecordRequest, canonicalTargetText: string, record: GeminiRunningRecord): AlignmentResponse {
  const canonical = targetTokens(canonicalTargetText);
  if (record.tokens.length !== canonical.length) throw new Error("Gemini token count did not match the canonical story.");

  const tokens: TokenAlignment[] = canonical.map((target, index) => {
    const candidate = record.tokens[index];
    const client = request.telemetry.tokens[index];
    if (candidate.index !== index || normalizeWord(candidate.token) !== target.normalizedToken) {
      throw new Error(`Gemini changed canonical token ${index}.`);
    }

    const accent = findAccentInvariant({
      expected: target.normalizedToken,
      observed: candidate.heardAs || client?.heardAs,
      phonemes: candidate.phoneticDisplay,
      localeProfile: request.localeProfile,
      evaluationMode: request.evaluationMode,
    });
    let status: AlignmentStatus = candidate.status;
    if (accent) status = "accepted-regional-variant";
    else if (client?.status === "self-corrected") status = "self-corrected";
    else if (candidate.status === "accepted-regional-variant" && request.evaluationMode !== "regional-restraint") status = "correct";

    const heardAs = candidate.heardAs || client?.heardAs;
    const unsupportedError = ["substitution", "omission", "review"].includes(status)
      && (!heardAs || normalizeWord(heardAs) === target.normalizedToken)
      && !request.audioEvidence?.some((evidence) => normalizeWord(evidence.targetToken) === target.normalizedToken);
    if (unsupportedError && client && !client.scoreImpact) status = alignmentStatus(client.status);

    return {
      id: `${request.sessionId}-${index}`,
      token: target.token,
      index,
      status,
      confidence: Math.min(1, Math.max(0, candidate.confidence)),
      heardAs: heardAs || undefined,
      phoneticDisplay: candidate.phoneticDisplay || undefined,
      explanation: accent?.explanation ?? candidate.explanation,
      scoreImpact: hasScoreImpact(status, candidate.errorType),
      falseCorrection: status === "accepted-regional-variant" ? false : candidate.falseCorrection,
      cueRecommendation: candidate.cueRecommendation || undefined,
    };
  });

  return buildResponse(request, tokens, "gemini");
}
