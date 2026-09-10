"use client";

/* Reference-led rule: shared state must remain invisible to the child-facing composition and preserve one calm action at a time. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_STATE, SEEDED_RUNNING_RECORD, getStory, getStorySnapshot } from "@/lib/seed";
import { loadReaderLeaderState, saveReaderLeaderState } from "@/lib/session-storage";
import { recalculateAlignmentMetrics } from "@/lib/reading-metrics";
import type { AlignmentResponse, AttemptAudioSnippet, EvaluationMode, ReadAloudTelemetry, ReaderLeaderState, Story } from "@/lib/domain";

interface SessionContextValue {
  state: ReaderLeaderState;
  hydrated: boolean;
  selectStory: (story: Story) => void;
  prepareReadingAttempt: () => void;
  startReading: () => void;
  setCurrentToken: (tokenIndex: number) => void;
  setEvaluationMode: (mode: EvaluationMode) => void;
  beginAlignment: (elapsedMs: number) => void;
  completeReading: (alignment: AlignmentResponse, elapsedMs: number, attemptSnippets?: AttemptAudioSnippet[], telemetry?: ReadAloudTelemetry) => void;
  confirmPhonicsError: (tokenId: string, reason: string) => void;
  confirmMisread: (tokenId: string, reason: string) => void;
  confirmOverride: (tokenId: string, reason: string) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReaderLeaderState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.readerLeaderHydrated = "true";
    const restored = loadReaderLeaderState(window.localStorage);
    queueMicrotask(() => {
      setState(restored);
      setHydrated(true);
    });
    return () => {
      delete document.documentElement.dataset.readerLeaderHydrated;
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveReaderLeaderState(window.localStorage, state);
  }, [hydrated, state]);

  const selectStory = useCallback((story: Story) => {
    setState((current) => ({
      ...current,
      selectedStoryId: story.id,
      session: {
        id: `session-${Date.now()}`,
        studentId: current.session.studentId,
        storyId: story.id,
        storySnapshot: getStorySnapshot(story),
        localeProfile: current.session.evaluationMode === "regional-restraint" ? "en-IE" : "en-GB",
        evaluationMode: current.session.evaluationMode,
        status: "ready",
        currentTokenIndex: 0,
        elapsedMs: 0,
        alignment: undefined,
        telemetry: undefined,
        attemptSnippets: undefined,
        attemptSnippet: undefined,
        earnedBadges: [],
      },
    }));
  }, []);

  const prepareReadingAttempt = useCallback(() => {
    setState((current) => ({
      ...current,
      session: {
        ...current.session,
        id: `session-${Date.now()}`,
        status: "ready",
        currentTokenIndex: 0,
        elapsedMs: 0,
        alignment: undefined,
        telemetry: undefined,
        attemptSnippets: undefined,
        attemptSnippet: undefined,
        earnedBadges: [],
        startedAt: undefined,
        completedAt: undefined,
      },
    }));
  }, []);

  const startReading = useCallback(() => {
    setState((current) => ({
      ...current,
      session: { ...current.session, status: "reading", currentTokenIndex: 0, startedAt: new Date().toISOString(), completedAt: undefined, elapsedMs: 0, alignment: undefined, telemetry: undefined, attemptSnippets: undefined, attemptSnippet: undefined },
    }));
  }, []);

  const setCurrentToken = useCallback((tokenIndex: number) => {
    setState((current) => ({ ...current, session: { ...current.session, currentTokenIndex: Math.max(0, tokenIndex) } }));
  }, []);

  const setEvaluationMode = useCallback((mode: EvaluationMode) => {
    setState((current) => ({
      ...current,
      session: {
        ...current.session,
        evaluationMode: mode,
        localeProfile: mode === "regional-restraint" ? "en-IE" : "en-GB",
      },
    }));
  }, []);

  const beginAlignment = useCallback((elapsedMs: number) => {
    setState((current) => ({ ...current, session: { ...current.session, status: "aligning", elapsedMs } }));
  }, []);

  const completeReading = useCallback((alignment: AlignmentResponse, elapsedMs: number, attemptSnippets?: AttemptAudioSnippet[], telemetry?: ReadAloudTelemetry) => {
    setState((current) => ({
      ...current,
      session: {
        ...current.session,
        status: "complete",
        alignment,
        telemetry,
        attemptSnippets,
        attemptSnippet: attemptSnippets?.find((snippet) => snippet.token === "knight"),
        elapsedMs,
        completedAt: new Date().toISOString(),
        earnedBadges: ["great-listening", "phonics-champion", "speed-reader"],
      },
    }));
  }, []);

  const confirmPhonicsError = useCallback((tokenId: string, reason: string) => {
    setState((current) => {
      const alignment = current.session.alignment ?? SEEDED_RUNNING_RECORD;
      const token = alignment?.tokens.find((candidate) => candidate.id === tokenId);
      if (!alignment || !token || token.status === "confirmed-phonics-error") return current;
      const usingSeededRecord = !current.session.alignment;

      const updatedAlignment = recalculateAlignmentMetrics({
        ...alignment,
        tokens: alignment.tokens.map((candidate) => candidate.id === tokenId
          ? {
              ...candidate,
              status: "confirmed-phonics-error",
              scoreImpact: true,
              explanation: "Confirmed: child sounded the silent ‘k’ in ‘knight’ (/k-n-aɪ-t/).",
              cueRecommendation: "Silent consonant intervention required.",
            }
          : candidate),
      });

      return {
        ...current,
        session: {
          ...current.session,
          id: usingSeededRecord ? alignment.sessionId : current.session.id,
          storyId: usingSeededRecord ? "brave-knight" : current.session.storyId,
          storySnapshot: usingSeededRecord ? getStorySnapshot(getStory("brave-knight")) : current.session.storySnapshot,
          alignment: updatedAlignment,
        },
        overrides: [...current.overrides, {
          id: globalThis.crypto.randomUUID(),
          sessionId: usingSeededRecord ? alignment.sessionId : current.session.id,
          tokenId,
          previousStatus: token.status,
          nextStatus: "confirmed-phonics-error",
          actorLabel: "Jack Murphy’s educator",
          reason,
          createdAt: new Date().toISOString(),
        }],
      };
    });
  }, []);

  const confirmMisread = useCallback((tokenId: string, reason: string) => {
    setState((current) => {
      const alignment = current.session.alignment ?? SEEDED_RUNNING_RECORD;
      const token = alignment.tokens.find((candidate) => candidate.id === tokenId);
      if (!token || token.status === "confirmed-misread") return current;
      const usingSeededRecord = !current.session.alignment;
      const updatedAlignment = recalculateAlignmentMetrics({
        ...alignment,
        tokens: alignment.tokens.map((candidate) => candidate.id === tokenId
          ? {
              ...candidate,
              status: "confirmed-misread",
              scoreImpact: true,
              falseCorrection: false,
              explanation: `${candidate.explanation ?? "Pronunciation reviewed."} Authentic misread confirmed by educator.`,
            }
          : candidate),
      });

      return {
        ...current,
        session: {
          ...current.session,
          id: usingSeededRecord ? alignment.sessionId : current.session.id,
          storyId: usingSeededRecord ? "brave-knight" : current.session.storyId,
          storySnapshot: usingSeededRecord ? getStorySnapshot(getStory("brave-knight")) : current.session.storySnapshot,
          alignment: updatedAlignment,
        },
        overrides: [...current.overrides, {
          id: globalThis.crypto.randomUUID(),
          sessionId: usingSeededRecord ? alignment.sessionId : current.session.id,
          tokenId,
          previousStatus: token.status,
          nextStatus: "confirmed-misread",
          actorLabel: "Jack Murphy’s educator",
          reason,
          createdAt: new Date().toISOString(),
        }],
      };
    });
  }, []);

  const confirmOverride = useCallback((tokenId: string, reason: string) => {
    setState((current) => {
      const alignment = current.session.alignment ?? SEEDED_RUNNING_RECORD;
      const token = alignment?.tokens.find((candidate) => candidate.id === tokenId);
      if (!alignment || !token || token.status === "accepted-teacher-override") return current;
      const usingSeededRecord = !current.session.alignment;

      const updatedAlignment = recalculateAlignmentMetrics({
        ...alignment,
        tokens: alignment.tokens.map((candidate) => candidate.id === tokenId
          ? { ...candidate, status: "accepted-teacher-override", scoreImpact: false, falseCorrection: false, explanation: `${candidate.explanation ?? "Pronunciation reviewed."} Accepted by educator.` }
          : candidate),
      });

      return {
        ...current,
        session: {
          ...current.session,
          id: usingSeededRecord ? alignment.sessionId : current.session.id,
          storyId: usingSeededRecord ? "brave-knight" : current.session.storyId,
          storySnapshot: usingSeededRecord ? getStorySnapshot(getStory("brave-knight")) : current.session.storySnapshot,
          alignment: updatedAlignment,
        },
        overrides: [...current.overrides, {
          id: globalThis.crypto.randomUUID(),
          sessionId: usingSeededRecord ? alignment.sessionId : current.session.id,
          tokenId,
          previousStatus: token.status,
          nextStatus: "accepted-teacher-override",
          actorLabel: "Jack Murphy’s educator",
          reason,
          createdAt: new Date().toISOString(),
        }],
      };
    });
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);
  const value = useMemo(() => ({ state, hydrated, selectStory, prepareReadingAttempt, startReading, setCurrentToken, setEvaluationMode, beginAlignment, completeReading, confirmPhonicsError, confirmMisread, confirmOverride, reset }), [beginAlignment, completeReading, confirmMisread, confirmOverride, confirmPhonicsError, hydrated, prepareReadingAttempt, reset, selectStory, setCurrentToken, setEvaluationMode, startReading, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useReaderSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useReaderSession must be used within SessionProvider");
  return context;
}
