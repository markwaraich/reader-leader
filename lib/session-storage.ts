/** Session persistence rule: validate and migrate browser state so stale local data never breaks the reading path. */
import { z } from "zod";
import type { ReaderLeaderState, StoryId } from "@/lib/domain";
import { DEFAULT_STATE, STORIES, getStory, getStorySnapshot } from "@/lib/seed";

export const READER_SESSION_STORAGE_KEY = "reader-leader-session-v3";
const STORAGE_VERSION = 3 as const;

const persistedSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  state: z.object({
    selectedStoryId: z.string(),
    session: z.object({ id: z.string(), storyId: z.string() }).passthrough(),
    overrides: z.array(z.unknown()),
  }).passthrough(),
});

function isStoryId(value: string): value is StoryId {
  return STORIES.some((story) => story.id === value);
}

function normaliseState(value: unknown): ReaderLeaderState {
  if (!value || typeof value !== "object") return DEFAULT_STATE;
  const candidate = value as Partial<ReaderLeaderState>;
  const requestedId = typeof candidate.selectedStoryId === "string" && isStoryId(candidate.selectedStoryId)
    ? candidate.selectedStoryId
    : DEFAULT_STATE.selectedStoryId;
  const rawSession = candidate.session && typeof candidate.session === "object" ? candidate.session : DEFAULT_STATE.session;
  const sessionStoryId = typeof rawSession.storyId === "string" && isStoryId(rawSession.storyId) ? rawSession.storyId : requestedId;
  const story = getStory(sessionStoryId);
  const isObsoletePhaseOneRecord = rawSession.id === "session-jack-001"
    && rawSession.storyId === "fat-cat"
    && rawSession.alignment?.sessionId === "session-jack-001";
  const evaluationMode = rawSession.evaluationMode === "standard-rp" ? "standard-rp" : "regional-restraint";
  const attemptSnippet = rawSession.attemptSnippet
    && typeof rawSession.attemptSnippet.dataUri === "string"
    && rawSession.attemptSnippet.dataUri.startsWith("data:audio/")
    ? rawSession.attemptSnippet
    : undefined;
  const attemptSnippets = Array.isArray(rawSession.attemptSnippets)
    ? rawSession.attemptSnippets.filter((snippet) => snippet
      && typeof snippet.dataUri === "string"
      && snippet.dataUri.startsWith("data:audio/"))
    : attemptSnippet
      ? [attemptSnippet]
      : undefined;
  const telemetry = rawSession.telemetry
    && rawSession.telemetry.version === 1
    && rawSession.telemetry.sessionId === rawSession.id
    && Array.isArray(rawSession.telemetry.tokens)
    && Array.isArray(rawSession.telemetry.events)
    && Array.isArray(rawSession.telemetry.observations)
    ? rawSession.telemetry
    : undefined;

  return {
    ...DEFAULT_STATE,
    ...candidate,
    selectedStoryId: requestedId,
    session: {
      ...DEFAULT_STATE.session,
      ...rawSession,
      storyId: sessionStoryId,
      storySnapshot: rawSession.storySnapshot ?? getStorySnapshot(story),
      evaluationMode,
      localeProfile: evaluationMode === "regional-restraint" ? "en-IE" : "en-GB",
      elapsedMs: rawSession.elapsedMs ?? 0,
      alignment: isObsoletePhaseOneRecord ? undefined : rawSession.alignment,
      telemetry,
      attemptSnippets,
      attemptSnippet,
    },
    overrides: Array.isArray(candidate.overrides) ? candidate.overrides : [],
  };
}

export function loadReaderLeaderState(storage: Storage): ReaderLeaderState {
  try {
    const current = storage.getItem(READER_SESSION_STORAGE_KEY);
    if (current) {
      const parsed = persistedSchema.safeParse(JSON.parse(current));
      if (parsed.success) return normaliseState(parsed.data.state);
    }

    const versionTwo = storage.getItem("reader-leader-session-v2");
    if (versionTwo) {
      const parsed = JSON.parse(versionTwo) as { state?: unknown };
      return normaliseState(parsed.state ?? parsed);
    }

    const versionOne = storage.getItem("reader-leader-session-v1");
    return versionOne ? normaliseState(JSON.parse(versionOne)) : DEFAULT_STATE;
  } catch {
    storage.removeItem(READER_SESSION_STORAGE_KEY);
    return DEFAULT_STATE;
  }
}

export function saveReaderLeaderState(storage: Storage, state: ReaderLeaderState): void {
  storage.setItem(READER_SESSION_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state }));
}
