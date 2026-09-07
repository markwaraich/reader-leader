import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { GeminiTargetToken } from "@/lib/domain";
import {
  enforceReaderLeaderDiagnosticPolicy,
  geminiAudioDiagnosticJsonSchema,
  geminiAudioDiagnosticSchema,
  type GeminiAudioDiagnostic,
} from "@/lib/server/gemini-diagnostic-policy";

const SYSTEM_INSTRUCTION = `You are Reader Leader's post-read pronunciation diagnostic assistant for UK and Hiberno-English early readers.
Return only the requested structured JSON and assess only the supplied target word in the short WAV clip.

Accent Restraint Rule: If the accent profile is "Hiberno-English / Northern Irish", the target word is "horse", and the child uses rhotic /hɔːɹs/, return status="accepted-regional-variant", errorType="none", and restraintApplied=true. Do not penalise that regional pronunciation.

Silent Letter Phonics Rule: If the target word is "knight" and the child sounds the initial silent k as /k-n-aɪ-t/, return status="misread", errorType="grapheme-confusion", and restraintApplied=false.

If the target is read fluently, return status="fluent" and errorType="none". If the clip contains a prolonged attempt without a completed word, return status="hesitation". Keep diagnosticReasoning concise and evidence-based.`;

export interface EvaluateAudioWithGeminiInput {
  apiKey: string;
  model?: string;
  audioBase64: string;
  audioMimeType: "audio/wav";
  targetToken: GeminiTargetToken;
  accentProfile: string;
}

export async function evaluateAudioWithGemini({
  apiKey,
  model = "gemini-2.5-flash",
  audioBase64,
  audioMimeType,
  targetToken,
  accentProfile,
}: EvaluateAudioWithGeminiInput): Promise<GeminiAudioDiagnostic> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [
        {
          text: `Target word: ${targetToken}\nAccent profile: ${accentProfile}\nAnalyse only this target word in the attached two-second WAV clip.`,
        },
        { inlineData: { data: audioBase64, mimeType: audioMimeType } },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: geminiAudioDiagnosticJsonSchema,
      temperature: 0,
    },
  });

  if (!response.text) throw new Error("Gemini returned no diagnostic content.");
  const parsed = geminiAudioDiagnosticSchema.parse(JSON.parse(response.text));
  return enforceReaderLeaderDiagnosticPolicy(parsed, targetToken, accentProfile);
}
