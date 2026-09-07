import { z } from "zod";
import type { GeminiTargetToken } from "@/lib/domain";

export const geminiAudioDiagnosticSchema = z.object({
  targetToken: z.string().min(1),
  spokenPhonemes: z.string().min(1),
  status: z.enum(["fluent", "accepted-regional-variant", "misread", "hesitation"]),
  errorType: z.enum(["none", "substitution", "omission", "grapheme-confusion"]),
  restraintApplied: z.boolean(),
  diagnosticReasoning: z.string().min(1),
});

export type GeminiAudioDiagnostic = z.infer<typeof geminiAudioDiagnosticSchema>;

export const geminiAudioDiagnosticJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targetToken: { type: "string" },
    spokenPhonemes: { type: "string" },
    status: {
      type: "string",
      enum: ["fluent", "accepted-regional-variant", "misread", "hesitation"],
    },
    errorType: {
      type: "string",
      enum: ["none", "substitution", "omission", "grapheme-confusion"],
    },
    restraintApplied: { type: "boolean" },
    diagnosticReasoning: { type: "string" },
  },
  required: [
    "targetToken",
    "spokenPhonemes",
    "status",
    "errorType",
    "restraintApplied",
    "diagnosticReasoning",
  ],
} as const;

function hasSoundedInitialK(spokenPhonemes: string): boolean {
  const compact = spokenPhonemes.toLowerCase().replace(/\s+/g, "");
  return compact.startsWith("/k-") || compact.startsWith("k-") || compact.startsWith("/kn") || compact.startsWith("kn");
}

function hasRhoticHorseEvidence(diagnostic: GeminiAudioDiagnostic): boolean {
  const evidence = `${diagnostic.spokenPhonemes} ${diagnostic.diagnosticReasoning}`.toLowerCase();
  return evidence.includes("ɹ") || evidence.includes("rhotic") || evidence.includes("/hɔːrs/");
}

export function enforceReaderLeaderDiagnosticPolicy(
  diagnostic: GeminiAudioDiagnostic,
  targetToken: GeminiTargetToken,
  accentProfile: string,
): GeminiAudioDiagnostic {
  if (targetToken === "knight" && hasSoundedInitialK(diagnostic.spokenPhonemes)) {
    return {
      ...diagnostic,
      targetToken,
      status: "misread",
      errorType: "grapheme-confusion",
      restraintApplied: false,
      diagnosticReasoning: "Child sounded out the silent ‘k’ in ‘knight’; retain for educator review.",
    };
  }

  if (
    targetToken === "horse"
    && accentProfile === "Hiberno-English / Northern Irish"
    && hasRhoticHorseEvidence(diagnostic)
  ) {
    return {
      ...diagnostic,
      targetToken,
      status: "accepted-regional-variant",
      errorType: "none",
      restraintApplied: true,
      diagnosticReasoning: "Accepted rhotic /r/ in Hiberno-English and Northern Irish speech. Reader Leader stays silent.",
    };
  }

  return { ...diagnostic, targetToken };
}
