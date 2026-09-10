"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccentProfile, RecognitionObservation, RecognitionSupport } from "@/lib/domain";

const RESTART_DELAY_MS = 250;
type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechWindow = typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface UseSpeechRecognitionOptions {
  localeProfile: AccentProfile;
  onObservation: (observation: RecognitionObservation) => void;
  onRestart?: (atMs: number) => void;
  onError?: (message: string, atMs: number) => void;
}

function observationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `recognition-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useSpeechRecognition({ localeProfile, onObservation, onRestart, onError }: UseSpeechRecognitionOptions) {
  const [support, setSupport] = useState<RecognitionSupport>("unavailable");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const optionsRef = useRef({ localeProfile, onObservation, onRestart, onError });
  useEffect(() => {
    optionsRef.current = { localeProfile, onObservation, onRestart, onError };
  }, [localeProfile, onError, onObservation, onRestart]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setIsActive(false);
    generationRef.current += 1;
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    }
    setInterimTranscript("");
  }, [clearRestartTimer]);

  const createAndStartRef = useRef<() => void>(() => undefined);
  const createAndStart = useCallback(() => {
    if (!activeRef.current) return;
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      activeRef.current = false;
      setIsActive(false);
      setSupport("unavailable");
      setErrorMessage("Live word tracking is not available in this browser. Manual progression remains available.");
      return;
    }

    const generation = generationRef.current;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = optionsRef.current.localeProfile;

    recognition.onresult = (event) => {
      if (!activeRef.current || generation !== generationRef.current) return;
      let interim = "";
      for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results[resultIndex];
        const alternatives = Array.from(result).slice(0, 3).map((alternative) => ({
          transcript: alternative.transcript.trim(),
          confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : 0,
        }));
        const transcript = alternatives[0]?.transcript ?? "";
        if (result.isFinal && transcript) {
          optionsRef.current.onObservation({
            id: observationId(),
            resultIndex,
            transcript,
            alternatives,
            confidence: alternatives[0]?.confidence ?? 0,
            isFinal: true,
            atMs: performance.now(),
          });
        } else {
          interim += `${transcript} `;
        }
      }
      setInterimTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      if (!activeRef.current || generation !== generationRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setIsActive(false);
        setSupport("failed");
        const message = "Speech recognition permission was not granted. Manual progression remains available.";
        setErrorMessage(message);
        optionsRef.current.onError?.(message, performance.now());
        return;
      }
      if (event.error !== "aborted" && event.error !== "no-speech") {
        const message = `Live word tracking paused (${event.error}). Reconnecting…`;
        setErrorMessage(message);
        optionsRef.current.onError?.(message, performance.now());
      }
    };

    recognition.onend = () => {
      if (!activeRef.current || generation !== generationRef.current) return;
      recognitionRef.current = null;
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        if (!activeRef.current || generation !== generationRef.current) return;
        optionsRef.current.onRestart?.(performance.now());
        createAndStartRef.current();
      }, RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setSupport("available");
      setErrorMessage(null);
    } catch (error) {
      recognitionRef.current = null;
      const message = error instanceof Error ? error.message : "Speech recognition could not start.";
      setErrorMessage(`${message} Reconnecting…`);
      optionsRef.current.onError?.(message, performance.now());
      restartTimerRef.current = setTimeout(() => createAndStartRef.current(), RESTART_DELAY_MS);
    }
  }, [clearRestartTimer]);

  useEffect(() => {
    createAndStartRef.current = createAndStart;
  }, [createAndStart]);

  const start = useCallback((): boolean => {
    stop();
    const speechWindow = window as SpeechWindow;
    if (!(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition)) {
      setSupport("unavailable");
      setErrorMessage("Live word tracking is not available in this browser. Manual progression remains available.");
      return false;
    }
    activeRef.current = true;
    setIsActive(true);
    generationRef.current += 1;
    setInterimTranscript("");
    setErrorMessage(null);
    createAndStartRef.current();
    return true;
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    support,
    interimTranscript,
    errorMessage,
    isActive,
    start,
    stop,
  };
}
