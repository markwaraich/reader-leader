import { z } from "zod";

const storyIdSchema = z.enum(["fat-cat", "big-dog", "sun-bun", "pig-in-mud", "red-hen", "frog-log", "bears-hat", "ship-trip", "fox-box", "brave-knight", "lost-shield", "kings-ring"]);
const liveStatusSchema = z.enum(["pending", "correct", "accepted-regional-variant", "substitution", "omission", "self-corrected"]);
const alignmentStatusSchema = z.enum(["correct", "accepted-regional-variant", "self-corrected", "review", "substitution", "omission", "hesitation"]);
const errorTypeSchema = z.enum(["none", "substitution", "omission", "grapheme-confusion", "hesitation"]);

const metricsSchema = z.object({
  accuracyRate: z.number().min(0).max(100),
  wcpm: z.number().nonnegative(),
  elapsedSeconds: z.number().positive(),
  falseCorrectionRate: z.number().min(0).max(100),
  totalWords: z.number().int().nonnegative(),
  correctWords: z.number().int().nonnegative(),
  substitutions: z.number().int().nonnegative(),
  omissions: z.number().int().nonnegative(),
  selfCorrections: z.number().int().nonnegative(),
  interventions: z.number().int().nonnegative(),
}).strict();

const liveTokenSchema = z.object({
  id: z.string().min(1).max(120),
  token: z.string().min(1).max(80),
  normalizedToken: z.string().min(1).max(80),
  index: z.number().int().nonnegative(),
  status: liveStatusSchema,
  heardAs: z.string().max(120).optional(),
  firstAttempt: z.string().max(120).optional(),
  confidence: z.number().min(0).max(1).optional(),
  explanation: z.string().max(500).optional(),
  scoreImpact: z.boolean(),
  falseCorrection: z.boolean().optional(),
}).strict();

const observationSchema = z.object({
  id: z.string().min(1).max(120),
  resultIndex: z.number().int().nonnegative(),
  transcript: z.string().max(1_000),
  alternatives: z.array(z.object({ transcript: z.string().max(1_000), confidence: z.number().min(0).max(1) }).strict()).max(3),
  confidence: z.number().min(0).max(1),
  isFinal: z.literal(true),
  atMs: z.number().nonnegative(),
}).strict();

const telemetryEventSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["speech-start", "speech-end", "visual-nudge", "intervention", "recognition-restart", "recognition-error"]),
  atMs: z.number().nonnegative(),
  tokenIndex: z.number().int().nonnegative(),
  detail: z.string().max(500).optional(),
}).strict();

export const finalizeRunningRecordRequestSchema = z.object({
  version: z.literal(1),
  sessionId: z.string().min(1).max(120),
  storyId: storyIdSchema,
  localeProfile: z.enum(["en-GB", "en-IE"]),
  evaluationMode: z.enum(["standard-rp", "regional-restraint"]),
  elapsedMs: z.number().min(1_000).max(3_600_000),
  telemetry: z.object({
    version: z.literal(1),
    sessionId: z.string().min(1).max(120),
    storyId: storyIdSchema,
    targetText: z.string().min(1).max(20_000),
    localeProfile: z.enum(["en-GB", "en-IE"]),
    evaluationMode: z.enum(["standard-rp", "regional-restraint"]),
    status: z.enum(["idle", "reading", "complete"]),
    startedAtIso: z.string().max(80).optional(),
    elapsedMs: z.number().nonnegative().max(3_600_000),
    currentTokenIndex: z.number().int().nonnegative(),
    recognitionSupport: z.enum(["available", "unavailable", "failed"]),
    interimTranscript: z.string().max(2_000),
    finalTranscript: z.string().max(20_000),
    observations: z.array(observationSchema).max(100),
    events: z.array(telemetryEventSchema).max(500),
    tokens: z.array(liveTokenSchema).min(1).max(200),
    metrics: metricsSchema,
  }).strict(),
  audioEvidence: z.array(z.object({
    targetToken: z.string().min(1).max(80),
    audioBase64: z.string().min(4).max(2_000_000),
    audioMimeType: z.literal("audio/wav"),
    audioBytes: z.number().int().nonnegative().max(1_500_000),
  }).strict()).max(4).optional(),
}).strict();

export type ValidatedFinalizeRunningRecordRequest = z.infer<typeof finalizeRunningRecordRequestSchema>;

export const geminiRunningRecordSchema = z.object({
  tokens: z.array(z.object({
    index: z.number().int().nonnegative(),
    token: z.string().min(1).max(80),
    status: alignmentStatusSchema,
    errorType: errorTypeSchema,
    heardAs: z.string().max(120),
    phoneticDisplay: z.string().max(120),
    confidence: z.number().min(0).max(1),
    explanation: z.string().min(1).max(500),
    cueRecommendation: z.string().max(500),
    falseCorrection: z.boolean(),
  }).strict()).min(1).max(200),
  summary: z.string().min(1).max(1_000),
}).strict();

export type GeminiRunningRecord = z.infer<typeof geminiRunningRecordSchema>;

/** Gemini supports only a subset of JSON Schema keywords; Zod above enforces all numeric and array bounds after parsing. */
export const geminiRunningRecordJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tokens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          token: { type: "string" },
          status: { type: "string", enum: alignmentStatusSchema.options },
          errorType: { type: "string", enum: errorTypeSchema.options },
          heardAs: { type: "string" },
          phoneticDisplay: { type: "string" },
          confidence: { type: "number" },
          explanation: { type: "string" },
          cueRecommendation: { type: "string" },
          falseCorrection: { type: "boolean" },
        },
        required: ["index", "token", "status", "errorType", "heardAs", "phoneticDisplay", "confidence", "explanation", "cueRecommendation", "falseCorrection"],
      },
    },
    summary: { type: "string" },
  },
  required: ["tokens", "summary"],
} as const;
