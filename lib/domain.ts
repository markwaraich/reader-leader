/** Shared Reader Leader contracts for stories, speech alignment, educator review, and the hesitation state machine. */

export type StoryId = "fat-cat" | "big-dog" | "sun-bun" | "pig-in-mud" | "red-hen" | "frog-log" | "bears-hat" | "ship-trip" | "fox-box" | "brave-knight" | "lost-shield" | "kings-ring";
export type BookBandId = "pink" | "red" | "yellow" | "green";
export type AccentProfile = "en-GB" | "en-IE";
export type EvaluationMode = "standard-rp" | "regional-restraint";
export type GeminiTargetToken = "knight" | "horse";

export interface Story {
  id: StoryId;
  title: string;
  level: 1 | 2 | 3 | 5;
  band: BookBandId;
  bandLabel: string;
  focus: string;
  targetText: string;
}

export type StorySnapshot = Pick<Story, "id" | "title" | "level" | "band" | "bandLabel" | "focus" | "targetText">;

export type AlignmentStatus = "correct" | "accepted-regional-variant" | "accepted-teacher-override" | "confirmed-phonics-error" | "confirmed-misread" | "self-corrected" | "review" | "substitution" | "omission" | "hesitation";

export interface TokenAlignment {
  id: string;
  token: string;
  index: number;
  status: AlignmentStatus;
  confidence: number;
  heardAs?: string;
  phoneticDisplay?: string;
  explanation?: string;
  startsAtMs?: number;
  endsAtMs?: number;
  scoreImpact: boolean;
  cueRecommendation?: string;
  falseCorrection?: boolean;
}

export interface ReadingMetrics {
  accuracyRate: number;
  wcpm: number;
  elapsedSeconds: number;
  falseCorrectionRate: number;
  totalWords: number;
  correctWords: number;
  substitutions: number;
  omissions: number;
  selfCorrections: number;
  interventions: number;
}

export type RecognitionSupport = "available" | "unavailable" | "failed";
export type LiveTokenStatus = "pending" | "correct" | "accepted-regional-variant" | "substitution" | "omission" | "self-corrected";

export interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface RecognitionObservation {
  id: string;
  resultIndex: number;
  transcript: string;
  alternatives: RecognitionAlternative[];
  confidence: number;
  isFinal: boolean;
  atMs: number;
}

export interface LiveTokenState {
  id: string;
  token: string;
  normalizedToken: string;
  index: number;
  status: LiveTokenStatus;
  heardAs?: string;
  firstAttempt?: string;
  confidence?: number;
  explanation?: string;
  scoreImpact: boolean;
  falseCorrection?: boolean;
}

export type TelemetryEventType = "speech-start" | "speech-end" | "visual-nudge" | "intervention" | "recognition-restart" | "recognition-error";

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  atMs: number;
  tokenIndex: number;
  detail?: string;
}

export interface ReadAloudTelemetry {
  version: 1;
  sessionId: string;
  storyId: StoryId;
  targetText: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  status: "idle" | "reading" | "complete";
  startedAtIso?: string;
  elapsedMs: number;
  currentTokenIndex: number;
  recognitionSupport: RecognitionSupport;
  interimTranscript: string;
  finalTranscript: string;
  observations: RecognitionObservation[];
  events: TelemetryEvent[];
  tokens: LiveTokenState[];
  metrics: ReadingMetrics;
}

export interface AudioEvidencePayload {
  targetToken: string;
  audioBase64: string;
  audioMimeType: "audio/wav";
  audioBytes: number;
}

export interface FinalizeRunningRecordRequest {
  version: 1;
  sessionId: string;
  storyId: StoryId;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  elapsedMs: number;
  telemetry: ReadAloudTelemetry;
  audioEvidence?: AudioEvidencePayload[];
}

export type AlignmentSource = "gemini" | "client-fallback" | "deterministic";

export interface AttemptAudioSnippet {
  token: string;
  tokenIndex: number;
  dataUri: string;
  mimeType: string;
  durationMs: number;
}

export interface AlignmentRequest {
  sessionId: string;
  storyId: StoryId;
  targetText: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  elapsedMs: number;
  isFinal: boolean;
  currentTokenIndex?: number;
  audioBytes?: number;
  targetToken?: GeminiTargetToken;
  audioBase64?: string;
  audioMimeType?: "audio/wav";
  demoAttempt?: "standard" | "sounded-silent-k";
}

export interface AlignmentResponse {
  sessionId: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  restraintApplied: boolean;
  lastConfirmedTokenIndex: number;
  tokens: TokenAlignment[];
  metrics: ReadingMetrics;
  source?: AlignmentSource;
  warning?: string;
}

export type HesitationState = "idle" | "requesting-permission" | "listening" | "speaking" | "hesitating" | "prompting" | "finishing" | "complete" | "permission-denied" | "unsupported" | "error";

export type HesitationEvent =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED"; atMs: number }
  | { type: "PERMISSION_DENIED" }
  | { type: "UNSUPPORTED" }
  | { type: "SPEECH"; atMs: number }
  | { type: "SILENCE"; atMs: number }
  | { type: "CLEAR_HESITATION"; atMs: number }
  | { type: "BEGIN_FINISH" }
  | { type: "FINISHED" }
  | { type: "FAIL" }
  | { type: "RESET" };

export interface HesitationMachine {
  phase: HesitationState;
  silenceStartedAtMs: number | null;
  silenceMs: number;
  lastSpeechAtMs: number | null;
}

export interface ReadingSession {
  id: string;
  studentId: string;
  storyId: StoryId;
  storySnapshot: StorySnapshot;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  status: "ready" | "reading" | "aligning" | "complete";
  currentTokenIndex: number;
  elapsedMs: number;
  alignment?: AlignmentResponse;
  telemetry?: ReadAloudTelemetry;
  attemptSnippets?: AttemptAudioSnippet[];
  /** Legacy single-snippet field retained for persisted-session migration. */
  attemptSnippet?: AttemptAudioSnippet;
  earnedBadges: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface OverrideEvent {
  id: string;
  sessionId: string;
  tokenId: string;
  previousStatus: AlignmentStatus;
  nextStatus: AlignmentStatus;
  actorLabel: string;
  reason: string;
  createdAt: string;
}

export interface StudentMetric { id: string; name: string; bookBand: "Gold" | "Silver" | "Bronze" | "Green"; accuracyRate: number; wcpm: number; }
export interface ReaderLeaderState { selectedStoryId: StoryId; session: ReadingSession; overrides: OverrideEvent[]; }
