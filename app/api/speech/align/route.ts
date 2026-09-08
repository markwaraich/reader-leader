/* Reference-led rule: live diagnostics may enrich one target token, while deterministic fixtures keep the judging loop available on every provider failure. */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AlignmentRequest } from "@/lib/domain";
import { buildDeterministicAlignment } from "@/lib/server/deterministic-alignment";
import { evaluateAudioWithGemini } from "@/lib/server/gemini-audio-diagnostic";
import { applyGeminiDiagnosticToAlignment } from "@/lib/server/gemini-alignment-mapper";

const MAX_BASE64_AUDIO_LENGTH = 2_000_000;
const alignmentSourceHeaders = (source: "gemini" | "deterministic") => ({
  "X-Reader-Leader-Alignment-Source": source,
});

const requestSchema = z.object({
  sessionId: z.string().min(1),
  storyId: z.enum(["fat-cat", "big-dog", "sun-bun", "pig-in-mud", "red-hen", "frog-log", "bears-hat", "ship-trip", "fox-box", "brave-knight", "lost-shield", "kings-ring"]),
  targetText: z.string().min(1),
  localeProfile: z.enum(["en-GB", "en-IE"]),
  evaluationMode: z.enum(["standard-rp", "regional-restraint"]),
  elapsedMs: z.number().nonnegative(),
  isFinal: z.boolean(),
  currentTokenIndex: z.number().int().nonnegative().optional(),
  audioBytes: z.number().int().nonnegative().optional(),
  targetToken: z.enum(["knight", "horse"]).optional(),
  audioBase64: z.string().min(4).max(MAX_BASE64_AUDIO_LENGTH).optional(),
  audioMimeType: z.literal("audio/wav").optional(),
  audioEvidence: z.array(z.object({
    targetToken: z.enum(["knight", "horse"]),
    audioBase64: z.string().min(4).max(MAX_BASE64_AUDIO_LENGTH),
    audioMimeType: z.literal("audio/wav"),
    audioBytes: z.number().int().nonnegative(),
  })).max(2).optional(),
  demoAttempt: z.enum(["standard", "sounded-silent-k"]).optional(),
});

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : "Unknown Gemini provider error";
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ALIGNMENT_REQUEST", issues: z.treeifyError(parsed.error) }, { status: 400 });

  const input: AlignmentRequest = parsed.data;
  const fallback = buildDeterministicAlignment(input);
  const apiKey = process.env.GEMINI_API_KEY;
  const evidence = parsed.data.audioEvidence?.length
    ? parsed.data.audioEvidence
    : input.targetToken && input.audioBase64 && input.audioMimeType === "audio/wav"
      ? [{ targetToken: input.targetToken, audioBase64: input.audioBase64, audioMimeType: input.audioMimeType, audioBytes: input.audioBytes ?? 0 }]
      : [];
  if (!apiKey || evidence.length === 0) {
    return NextResponse.json(fallback, { headers: alignmentSourceHeaders("deterministic") });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const accentProfile = input.localeProfile === "en-IE" && input.evaluationMode === "regional-restraint"
    ? "Hiberno-English / Northern Irish"
    : "Standard Received Pronunciation";

  let alignment = fallback;
  let liveDiagnostics = 0;
  for (const clip of evidence) {
    try {
      const diagnostic = await evaluateAudioWithGemini({
        apiKey,
        model,
        audioBase64: clip.audioBase64,
        audioMimeType: clip.audioMimeType,
        targetToken: clip.targetToken,
        accentProfile,
      });
      alignment = applyGeminiDiagnosticToAlignment(alignment, diagnostic, clip.targetToken);
      liveDiagnostics += 1;
    } catch (error) {
      console.error("[GeminiAlignmentFallback]", {
        sessionId: input.sessionId,
        targetToken: clip.targetToken,
        model,
        error: safeErrorMessage(error),
      });
    }
  }
  return NextResponse.json(alignment, {
    headers: alignmentSourceHeaders(liveDiagnostics > 0 ? "gemini" : "deterministic"),
  });
}
