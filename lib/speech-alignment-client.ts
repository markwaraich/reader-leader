/** Integration boundary: the reading UI depends on this typed client rather than the deterministic mock implementation. */
import type { AlignmentRequest, AlignmentResponse } from "@/lib/domain";
import { blobToAudioDataUri } from "@/lib/audio-data";

export async function alignSpeech(
  request: AlignmentRequest,
  audio: Blob | null,
  audioEvidence: Partial<Record<"knight" | "horse", Blob>> = {},
): Promise<AlignmentResponse> {
  const audioDataUri = audio?.type === "audio/wav" ? await blobToAudioDataUri(audio) : null;
  const audioBase64 = audioDataUri?.split(",", 2)[1];
  const evidenceEntries = await Promise.all(Object.entries(audioEvidence).map(async ([targetToken, blob]) => {
    const dataUri = blob.type === "audio/wav" ? await blobToAudioDataUri(blob) : null;
    return dataUri ? {
      targetToken,
      audioBase64: dataUri.split(",", 2)[1],
      audioMimeType: "audio/wav" as const,
      audioBytes: blob.size,
    } : null;
  }));
  const response = await fetch("/api/speech/align", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      audioBytes: audio?.size ?? 0,
      audioBase64,
      audioMimeType: audioBase64 ? "audio/wav" : undefined,
      audioEvidence: evidenceEntries.filter((entry) => entry !== null),
    }),
  });

  if (!response.ok) throw new Error("The reading record could not be generated.");
  return response.json() as Promise<AlignmentResponse>;
}
