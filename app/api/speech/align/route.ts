/* Stage 4 contract: validate bounded client telemetry, adjudicate once with Gemini, then enforce deterministic policy and scoring. */
import { NextResponse } from "next/server";
import { getStory } from "@/lib/seed";
import { evaluateRunningRecordWithGemini } from "@/lib/server/gemini-running-record";
import { buildClientFallbackRecord, reconcileGeminiRunningRecord } from "@/lib/server/running-record-policy";
import { finalizeRunningRecordRequestSchema } from "@/lib/server/running-record-schema";

const GEMINI_TIMEOUT_MS = 20_000;

function sourceHeaders(source: "gemini" | "client-fallback") {
  return { "X-Reader-Leader-Alignment-Source": source };
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : "Unknown Gemini provider error";
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Gemini running-record request timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const parsed = finalizeRunningRecordRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_ALIGNMENT_REQUEST", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  if (
    input.telemetry.sessionId !== input.sessionId
    || input.telemetry.storyId !== input.storyId
    || input.telemetry.localeProfile !== input.localeProfile
    || input.telemetry.evaluationMode !== input.evaluationMode
  ) {
    return NextResponse.json({ error: "INCONSISTENT_SESSION_TELEMETRY" }, { status: 400 });
  }

  const canonicalTargetText = getStory(input.storyId).targetText;
  const fallback = (warning: string) => buildClientFallbackRecord(input, canonicalTargetText, warning);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallback("Gemini is not configured; this record uses validated client alignment."), {
      headers: sourceHeaders("client-fallback"),
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  try {
    const record = await withTimeout(evaluateRunningRecordWithGemini({ apiKey, model, request: input, canonicalTargetText }), GEMINI_TIMEOUT_MS);
    const alignment = reconcileGeminiRunningRecord(input, canonicalTargetText, record);
    return NextResponse.json(alignment, { headers: sourceHeaders("gemini") });
  } catch (error) {
    const reason = safeErrorMessage(error);
    console.error("[GeminiRunningRecordFallback]", { sessionId: input.sessionId, model, error: reason });
    return NextResponse.json(fallback(`Gemini adjudication was unavailable; validated client alignment was retained. ${reason}`), {
      headers: sourceHeaders("client-fallback"),
    });
  }
}
