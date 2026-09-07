/** Integration boundary: the reading UI depends on this typed client rather than the deterministic mock implementation. */
import type { AlignmentRequest, AlignmentResponse } from "@/lib/domain";
import { blobToAudioDataUri } from "@/lib/audio-data";

export async function alignSpeech(
  request: AlignmentRequest,
  audio: Blob | null,
): Promise<AlignmentResponse> {
  const audioDataUri = audio?.type === "audio/wav" ? await blobToAudioDataUri(audio) : null;
  const audioBase64 = audioDataUri?.split(",", 2)[1];
  const response = await fetch("/api/speech/align", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      audioBytes: audio?.size ?? 0,
      audioBase64,
      audioMimeType: audioBase64 ? "audio/wav" : undefined,
    }),
  });

  if (!response.ok) throw new Error("The reading record could not be generated.");
  return response.json() as Promise<AlignmentResponse>;
}
