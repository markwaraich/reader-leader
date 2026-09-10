"use client";

import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { AccentProfile, EvaluationMode, ReadAloudTelemetry, RecognitionObservation, RecognitionSupport, StoryId, TelemetryEvent, TelemetryEventType } from "@/lib/domain";
import { alignTranscript } from "@/lib/read-aloud/alignment-engine";
import { calculateStage4Metrics } from "@/lib/read-aloud/scoring";

const MAX_OBSERVATIONS = 100;
const MAX_EVENTS = 500;

interface StartSessionInput {
  sessionId: string;
  storyId: StoryId;
  targetText: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
  recognitionSupport: RecognitionSupport;
}

export interface ReadAloudStoreState {
  telemetry: ReadAloudTelemetry | null;
  startSession: (input: StartSessionInput) => void;
  setRecognitionSupport: (support: RecognitionSupport) => void;
  setInterimTranscript: (transcript: string) => void;
  setCurrentTokenIndex: (tokenIndex: number) => void;
  ingestObservation: (observation: RecognitionObservation) => void;
  recordEvent: (type: TelemetryEventType, atMs: number, detail?: string) => void;
  finalize: (elapsedMs: number) => ReadAloudTelemetry | null;
  reset: () => void;
}

function eventId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `telemetry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createReadAloudStore(): StoreApi<ReadAloudStoreState> {
  return createStore<ReadAloudStoreState>((set, get) => ({
    telemetry: null,
    startSession: (input) => {
      const aligned = alignTranscript({ ...input, transcript: "" });
      set({
        telemetry: {
          version: 1,
          ...input,
          status: "reading",
          startedAtIso: new Date().toISOString(),
          elapsedMs: 0,
          currentTokenIndex: aligned.currentTokenIndex,
          interimTranscript: "",
          finalTranscript: "",
          observations: [],
          events: [],
          tokens: aligned.tokens,
          metrics: calculateStage4Metrics(aligned.tokens, 0),
        },
      });
    },
    setRecognitionSupport: (support) => set((state) => ({
      telemetry: state.telemetry ? { ...state.telemetry, recognitionSupport: support } : null,
    })),
    setInterimTranscript: (transcript) => set((state) => ({
      telemetry: state.telemetry ? { ...state.telemetry, interimTranscript: transcript } : null,
    })),
    setCurrentTokenIndex: (tokenIndex) => set((state) => ({
      telemetry: state.telemetry ? {
        ...state.telemetry,
        currentTokenIndex: Math.max(0, Math.min(state.telemetry.tokens.length - 1, tokenIndex)),
      } : null,
    })),
    ingestObservation: (observation) => set((state) => {
      const telemetry = state.telemetry;
      if (!telemetry || !observation.isFinal) return state;
      const finalTranscript = `${telemetry.finalTranscript} ${observation.transcript}`.trim();
      const aligned = alignTranscript({
        sessionId: telemetry.sessionId,
        targetText: telemetry.targetText,
        transcript: finalTranscript,
        localeProfile: telemetry.localeProfile,
        evaluationMode: telemetry.evaluationMode,
        confidence: observation.confidence,
      });
      const observations = [...telemetry.observations, observation].slice(-MAX_OBSERVATIONS);
      const interventions = telemetry.events.filter((event) => event.type === "intervention").length;
      return {
        telemetry: {
          ...telemetry,
          finalTranscript,
          interimTranscript: "",
          observations,
          tokens: aligned.tokens,
          currentTokenIndex: aligned.currentTokenIndex,
          metrics: calculateStage4Metrics(aligned.tokens, telemetry.elapsedMs, interventions),
        },
      };
    }),
    recordEvent: (type, atMs, detail) => set((state) => {
      const telemetry = state.telemetry;
      if (!telemetry) return state;
      const event: TelemetryEvent = {
        id: eventId(),
        type,
        atMs: Math.max(0, Math.round(atMs)),
        tokenIndex: telemetry.currentTokenIndex,
        detail,
      };
      const events = [...telemetry.events, event].slice(-MAX_EVENTS);
      const interventions = events.filter((candidate) => candidate.type === "intervention").length;
      return {
        telemetry: {
          ...telemetry,
          events,
          metrics: calculateStage4Metrics(telemetry.tokens, telemetry.elapsedMs, interventions),
        },
      };
    }),
    finalize: (elapsedMs) => {
      const telemetry = get().telemetry;
      if (!telemetry) return null;
      const aligned = alignTranscript({
        sessionId: telemetry.sessionId,
        targetText: telemetry.targetText,
        transcript: telemetry.finalTranscript,
        localeProfile: telemetry.localeProfile,
        evaluationMode: telemetry.evaluationMode,
        finalize: true,
      });
      const interventions = telemetry.events.filter((event) => event.type === "intervention").length;
      const completed: ReadAloudTelemetry = {
        ...telemetry,
        status: "complete",
        elapsedMs,
        interimTranscript: "",
        tokens: aligned.tokens,
        currentTokenIndex: aligned.currentTokenIndex,
        metrics: calculateStage4Metrics(aligned.tokens, elapsedMs, interventions),
      };
      set({ telemetry: completed });
      return completed;
    },
    reset: () => set({ telemetry: null }),
  }));
}

export const readAloudStore = createReadAloudStore();

export function useReadAloudStore<T>(selector: (state: ReadAloudStoreState) => T): T {
  return useStore(readAloudStore, selector);
}
