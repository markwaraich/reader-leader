/** Typed Stage 4 boundary: one bounded finalization request per completed reading. */
import type { AlignmentResponse, AudioEvidencePayload, FinalizeRunningRecordRequest, ReadAloudTelemetry } from "@/lib/domain";
import { blobToAudioDataUri } from "@/lib/audio-data";

export async function finalizeRunningRecord(
  telemetry: ReadAloudTelemetry,
  audioEvidence: Record<string, Blob> = {},
): Promise<AlignmentResponse> {
  const evidenceEntries = await Promise.all(Object.entries(audioEvidence).slice(0, 4).map(async ([targetToken, blob]): Promise<AudioEvidencePayload | null> => {
    if (blob.type !== "audio/wav") return null;
    const dataUri = await blobToAudioDataUri(blob);
    return {
      targetToken,
      audioBase64: dataUri.split(",", 2)[1],
      audioMimeType: "audio/wav",
      audioBytes: blob.size,
    };
  }));
  const request: FinalizeRunningRecordRequest = {
    version: 1,
    sessionId: telemetry.sessionId,
    storyId: telemetry.storyId,
    localeProfile: telemetry.localeProfile,
    evaluationMode: telemetry.evaluationMode,
    elapsedMs: telemetry.elapsedMs,
    telemetry,
    audioEvidence: evidenceEntries.filter((entry): entry is AudioEvidencePayload => entry !== null),
  };
  const response = await fetch("/api/speech/align", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw new Error("The completed running record could not be generated.");
  return response.json() as Promise<AlignmentResponse>;
}
