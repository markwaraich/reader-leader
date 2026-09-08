"use client";

/** Student restraint rule: own every Web Audio resource in one hook and tear it down idempotently on stop, failure, and unmount. */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { hesitationReducer, INITIAL_HESITATION_MACHINE } from "@/lib/hesitation-fsm";
import { ATTEMPT_SNIPPET_DURATION_MS, ATTEMPT_SNIPPET_PRE_ROLL_MS, createAttemptSnippetWindow, sliceAudioBlobToWav } from "@/lib/audio-data";

const VOICE_RMS_THRESHOLD = 0.028;
const VAD_WARMUP_MS = 300;
const SUSTAINED_SPEECH_MS = 90;
const SPEECH_RELEASE_MS = 180;
const UI_SAMPLE_INTERVAL_MS = 100;

export interface TimedAudioChunk {
  blob: Blob;
  endMs: number;
}

export interface AudioCaptureResult {
  blob: Blob | null;
  chunks: TimedAudioChunk[];
  snippetBlobs: Record<string, Blob>;
  elapsedMs: number;
}

export function useHesitationFSM() {
  const [machine, dispatch] = useReducer(hesitationReducer, INITIAL_HESITATION_MACHINE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speechStartedEpoch, setSpeechStartedEpoch] = useState(0);
  const [speechEndedEpoch, setSpeechEndedEpoch] = useState(0);
  const [speechStartedAtMs, setSpeechStartedAtMs] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const snippetWindowsRef = useRef(new Map<string, { startMs: number; durationMs: number }>());
  const chunksRef = useRef<TimedAudioChunk[]>([]);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number | null>(null);
  const voiceCandidateStartedAtRef = useRef<number | null>(null);
  const lastUiDispatchAtRef = useRef(0);
  const speakingRef = useRef(false);

  const disconnectAudioGraph = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.stop();
    }
    recorderRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const audioContext = contextRef.current;
    contextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);

    lastVoiceAtRef.current = null;
    voiceCandidateStartedAtRef.current = null;
    lastUiDispatchAtRef.current = 0;
    speakingRef.current = false;
  }, []);

  const captureSnippet = useCallback((token: string, tokenStartMs: number, durationMs = ATTEMPT_SNIPPET_DURATION_MS, preRollMs = ATTEMPT_SNIPPET_PRE_ROLL_MS): void => {
    if (snippetWindowsRef.current.has(token)) return;
    const window = preRollMs === ATTEMPT_SNIPPET_PRE_ROLL_MS && durationMs === ATTEMPT_SNIPPET_DURATION_MS
      ? createAttemptSnippetWindow(tokenStartMs)
      : { startMs: tokenStartMs - preRollMs, durationMs };
    snippetWindowsRef.current.set(token, { startMs: Math.max(0, window.startMs), durationMs: window.durationMs });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    disconnectAudioGraph();
    chunksRef.current = [];
    snippetWindowsRef.current.clear();
    setSpeechStartedEpoch(0);
    setSpeechEndedEpoch(0);
    setSpeechStartedAtMs(0);
    setErrorMessage(null);

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      dispatch({ type: "UNSUPPORTED" });
      setErrorMessage("Live listening is not supported in this browser. You can still continue the demo.");
      return false;
    }

    dispatch({ type: "REQUEST_PERMISSION" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const audioContext = new window.AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      contextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      startedAtRef.current = performance.now();
      lastVoiceAtRef.current = null;
      voiceCandidateStartedAtRef.current = null;

      if (typeof MediaRecorder !== "undefined") {
        const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
          .find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size === 0) return;
          const endMs = startedAtRef.current === null ? 0 : performance.now() - startedAtRef.current;
          chunksRef.current.push({ blob: event.data, endMs });
        };
        recorder.onerror = () => setErrorMessage("The recording could not be captured, but live support can continue.");
        recorder.start(250);
        recorderRef.current = recorder;
      }

      const samples = new Uint8Array(analyser.fftSize);
      const sample = (now: number) => {
        const activeAnalyser = analyserRef.current;
        if (!activeAnalyser) return;
        activeAnalyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const value of samples) {
          const normalised = (value - 128) / 128;
          energy += normalised * normalised;
        }
        const rms = Math.sqrt(energy / samples.length);
        const startedAt = startedAtRef.current;
        if (startedAt !== null && now - startedAt < VAD_WARMUP_MS) {
          lastVoiceAtRef.current = null;
          voiceCandidateStartedAtRef.current = null;
          speakingRef.current = false;
          frameRef.current = requestAnimationFrame(sample);
          return;
        }

        if (rms >= VOICE_RMS_THRESHOLD) {
          if (speakingRef.current) {
            lastVoiceAtRef.current = now;
          } else {
            voiceCandidateStartedAtRef.current ??= now;
            if (now - voiceCandidateStartedAtRef.current >= SUSTAINED_SPEECH_MS) lastVoiceAtRef.current = now;
          }
        } else {
          voiceCandidateStartedAtRef.current = null;
        }

        if (now - lastUiDispatchAtRef.current >= UI_SAMPLE_INTERVAL_MS) {
          lastUiDispatchAtRef.current = now;
          const recentlySpeaking = lastVoiceAtRef.current !== null && now - lastVoiceAtRef.current < SPEECH_RELEASE_MS;
          if (recentlySpeaking && !speakingRef.current) {
            const sessionStartedAt = startedAtRef.current ?? now;
            const detectedStart = voiceCandidateStartedAtRef.current ?? now;
            setSpeechStartedAtMs(Math.max(0, detectedStart - sessionStartedAt));
            setSpeechStartedEpoch((current) => current + 1);
          }
          if (!recentlySpeaking && speakingRef.current) setSpeechEndedEpoch((current) => current + 1);
          speakingRef.current = recentlySpeaking;
          dispatch({ type: recentlySpeaking ? "SPEECH" : "SILENCE", atMs: now });
        }
        frameRef.current = requestAnimationFrame(sample);
      };

      dispatch({ type: "PERMISSION_GRANTED", atMs: startedAtRef.current });
      frameRef.current = requestAnimationFrame(sample);
      return true;
    } catch (error) {
      disconnectAudioGraph();
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      dispatch({ type: denied ? "PERMISSION_DENIED" : "FAIL" });
      setErrorMessage(denied
        ? "Microphone access was not granted. You can allow access and try again, or continue the demo."
        : "The microphone could not start. You can still continue the demo.");
      return false;
    }
  }, [disconnectAudioGraph]);

  const finish = useCallback(async (): Promise<AudioCaptureResult> => {
    dispatch({ type: "BEGIN_FINISH" });
    const elapsedMs = startedAtRef.current === null ? 5_000 : Math.max(performance.now() - startedAtRef.current, 1_000);
    const recorder = recorderRef.current;
    const snippetWindows = [...snippetWindowsRef.current.entries()];

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    let blob: Blob | null = null;
    if (recorder && recorder.state !== "inactive") {
      blob = await new Promise<Blob>((resolve) => {
        const finishRecording = () => resolve(new Blob(chunksRef.current.map((chunk) => chunk.blob), { type: recorder.mimeType || "audio/webm" }));
        recorder.addEventListener("stop", finishRecording, { once: true });
        recorder.stop();
      });
    } else if (chunksRef.current.length > 0) {
      blob = new Blob(chunksRef.current.map((chunk) => chunk.blob), { type: chunksRef.current[0].blob.type || "audio/webm" });
    }

    const snippetBlobs: Record<string, Blob> = {};
    if (blob) {
      for (const [token, snippetWindow] of snippetWindows) {
        try {
          snippetBlobs[token] = await sliceAudioBlobToWav(blob, snippetWindow.startMs, snippetWindow.durationMs);
        } catch {
          setErrorMessage("The reading was captured, but a two-second evidence clip could not be prepared.");
        }
      }
    }

    const chunks = [...chunksRef.current];
    recorderRef.current = null;
    disconnectAudioGraph();
    startedAtRef.current = null;
    snippetWindowsRef.current.clear();
    dispatch({ type: "FINISHED" });
    return { blob, chunks, snippetBlobs, elapsedMs };
  }, [disconnectAudioGraph]);

  const cancel = useCallback(() => {
    disconnectAudioGraph();
    startedAtRef.current = null;
    chunksRef.current = [];
    snippetWindowsRef.current.clear();
    setSpeechStartedAtMs(0);
    setErrorMessage(null);
    dispatch({ type: "RESET" });
  }, [disconnectAudioGraph]);

  const clearHesitation = useCallback(() => {
    dispatch({ type: "CLEAR_HESITATION", atMs: performance.now() });
  }, []);

  useEffect(() => disconnectAudioGraph, [disconnectAudioGraph]);

  return {
    ...machine,
    errorMessage,
    speechStartedEpoch,
    speechStartedAtMs,
    speechEndedEpoch,
    isActive: ["listening", "speaking", "hesitating", "prompting"].includes(machine.phase),
    start,
    captureSnippet,
    clearHesitation,
    finish,
    cancel,
  };
}
