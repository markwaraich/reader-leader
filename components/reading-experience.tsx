"use client";

/* Stage 4 rule: VAD controls support timing; only final lexical observations control word progression and scoring. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigLeft, ArrowBigRight, LoaderCircle, Mic, Square } from "lucide-react";
import { StudentTopBar } from "@/components/student-top-bar";
import { ReadAloudStatus } from "@/components/read-aloud-status";
import { useReaderSession } from "@/app/providers";
import { useReadAloudAudio } from "@/hooks/use-read-aloud-audio";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { finalizeRunningRecord } from "@/lib/speech-alignment-client";
import { advanceTokenIndex, INITIAL_TOKEN_INDEX } from "@/lib/hesitation-fsm";
import { ATTEMPT_SNIPPET_DURATION_MS, ATTEMPT_SNIPPET_PRE_ROLL_MS, blobToAudioDataUri } from "@/lib/audio-data";
import { readAloudStore, useReadAloudStore } from "@/lib/read-aloud/telemetry-store";
import type { RecognitionObservation } from "@/lib/domain";

function stripPunctuation(token: string) {
  return token.toLowerCase().replace(/[^a-z']/g, "");
}

function phoneticCue(token: string): string {
  const word = stripPunctuation(token);
  const cues: Record<string, string> = {
    cat: "c · a · t",
    knight: "The k is silent: /n-aɪ-t/",
    night: "n · igh · t",
    horse: "h · or · se",
  };
  return cues[word] ?? word.split("").join(" · ");
}

export function ReadingExperience() {
  const router = useRouter();
  const { state, hydrated, prepareReadingAttempt, startReading, setCurrentToken, setEvaluationMode, beginAlignment, completeReading } = useReaderSession();
  const audio = useReadAloudAudio();
  const telemetry = useReadAloudStore((store) => store.telemetry);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);
  const handledSpeechStartRef = useRef(0);
  const handledSpeechEndRef = useRef(0);
  const handledNudgeRef = useRef(0);
  const handledInterventionRef = useRef(0);
  const finishingRef = useRef(false);
  const snippetRequestedRef = useRef(new Set<string>());
  const preparedStoryRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const story = state.session.storySnapshot;
  const words = story.targetText.split(/\s+/);
  const currentIndex = Math.min(telemetry?.currentTokenIndex ?? state.session.currentTokenIndex, words.length - 1);
  const showHighlight = audio.phase === "hesitating" || audio.phase === "prompting";
  const busy = !hydrated || audio.phase === "requesting-permission" || audio.phase === "finishing" || state.session.status === "aligning";

  const elapsedEventMs = useCallback((atMs = performance.now()) => Math.max(0, atMs - (sessionStartedAtRef.current ?? atMs)), []);
  const onObservation = useCallback((observation: RecognitionObservation) => {
    readAloudStore.getState().ingestObservation({ ...observation, atMs: elapsedEventMs(observation.atMs) });
  }, [elapsedEventMs]);
  const onRecognitionRestart = useCallback((atMs: number) => {
    readAloudStore.getState().recordEvent("recognition-restart", elapsedEventMs(atMs), "Recognition service reconnected while reading remained active.");
  }, [elapsedEventMs]);
  const onRecognitionError = useCallback((message: string, atMs: number) => {
    readAloudStore.getState().recordEvent("recognition-error", elapsedEventMs(atMs), message);
  }, [elapsedEventMs]);
  const recognition = useSpeechRecognition({
    localeProfile: state.session.localeProfile,
    onObservation,
    onRestart: onRecognitionRestart,
    onError: onRecognitionError,
  });

  const resetAttemptRefs = useCallback(() => {
    handledSpeechStartRef.current = 0;
    handledSpeechEndRef.current = 0;
    handledNudgeRef.current = 0;
    handledInterventionRef.current = 0;
    finishingRef.current = false;
    snippetRequestedRef.current.clear();
    sessionStartedAtRef.current = null;
  }, []);

  useEffect(() => {
    if (!hydrated || preparedStoryRef.current === story.id) return;
    preparedStoryRef.current = story.id;
    recognition.stop();
    audio.cancel();
    readAloudStore.getState().reset();
    resetAttemptRefs();
    prepareReadingAttempt();
  }, [audio, hydrated, prepareReadingAttempt, recognition, resetAttemptRefs, story.id]);

  useEffect(() => {
    if (telemetry) setCurrentToken(telemetry.currentTokenIndex);
  }, [setCurrentToken, telemetry]);

  useEffect(() => {
    readAloudStore.getState().setInterimTranscript(recognition.interimTranscript);
  }, [recognition.interimTranscript]);

  useEffect(() => {
    if (telemetry && telemetry.recognitionSupport !== recognition.support) {
      readAloudStore.getState().setRecognitionSupport(recognition.support);
    }
  }, [recognition.support, telemetry]);

  async function startMicrophone() {
    setAlignmentError(null);
    setCurrentToken(INITIAL_TOKEN_INDEX);
    recognition.stop();
    audio.cancel();
    resetAttemptRefs();
    sessionStartedAtRef.current = performance.now();
    readAloudStore.getState().startSession({
      sessionId: state.session.id,
      storyId: story.id,
      targetText: story.targetText,
      localeProfile: state.session.localeProfile,
      evaluationMode: state.session.evaluationMode,
      recognitionSupport: "unavailable",
    });
    const started = await audio.start();
    if (!started) {
      readAloudStore.getState().reset();
      return;
    }
    startReading();
    const recognitionAvailable = recognition.start();
    readAloudStore.getState().setRecognitionSupport(recognitionAvailable ? "available" : "unavailable");
  }

  const finishReading = useCallback(async () => {
    if (busy || finishingRef.current) return;
    finishingRef.current = true;
    setAlignmentError(null);
    recognition.stop();
    try {
      const capture = audio.isActive ? await audio.finish() : { snippetBlobs: {}, elapsedMs: Math.max(state.session.elapsedMs, 5_000) };
      beginAlignment(capture.elapsedMs);
      if (!readAloudStore.getState().telemetry) {
        readAloudStore.getState().startSession({
          sessionId: state.session.id,
          storyId: story.id,
          targetText: story.targetText,
          localeProfile: state.session.localeProfile,
          evaluationMode: state.session.evaluationMode,
          recognitionSupport: "unavailable",
        });
      }
      const completedTelemetry = readAloudStore.getState().finalize(capture.elapsedMs);
      if (!completedTelemetry) throw new Error("No read-aloud telemetry was available.");
      const alignment = await finalizeRunningRecord(completedTelemetry, capture.snippetBlobs);
      const attemptSnippets = await Promise.all(Object.entries(capture.snippetBlobs).map(async ([token, snippetBlob]) => ({
        token,
        tokenIndex: words.findIndex((word) => stripPunctuation(word) === token),
        dataUri: await blobToAudioDataUri(snippetBlob),
        mimeType: snippetBlob.type || "audio/wav",
        durationMs: ATTEMPT_SNIPPET_DURATION_MS,
      })));
      completeReading(alignment, capture.elapsedMs, attemptSnippets, completedTelemetry);
      router.push("/celebrate");
    } catch {
      setAlignmentError("We could not make the running record. Please try finishing again.");
      finishingRef.current = false;
    }
  }, [audio, beginAlignment, busy, completeReading, recognition, router, state.session.elapsedMs, state.session.evaluationMode, state.session.id, state.session.localeProfile, story.id, story.targetText, words]);

  useEffect(() => {
    if (!audio.isActive || audio.speechStartedEpoch === 0 || audio.speechStartedEpoch === handledSpeechStartRef.current) return;
    handledSpeechStartRef.current = audio.speechStartedEpoch;
    readAloudStore.getState().recordEvent("speech-start", elapsedEventMs());
    const currentWord = stripPunctuation(words[currentIndex]);
    if (["knight", "horse"].includes(currentWord) && !snippetRequestedRef.current.has(currentWord)) {
      snippetRequestedRef.current.add(currentWord);
      audio.captureSnippet(currentWord, audio.speechStartedAtMs, ATTEMPT_SNIPPET_DURATION_MS, ATTEMPT_SNIPPET_PRE_ROLL_MS);
    }
  }, [audio, currentIndex, elapsedEventMs, words]);

  useEffect(() => {
    if (!audio.isActive || audio.speechEndedEpoch === 0 || audio.speechEndedEpoch === handledSpeechEndRef.current) return;
    handledSpeechEndRef.current = audio.speechEndedEpoch;
    readAloudStore.getState().recordEvent("speech-end", elapsedEventMs());
  }, [audio.isActive, audio.speechEndedEpoch, elapsedEventMs]);

  useEffect(() => {
    if (!audio.isActive || audio.nudgeEpoch === 0 || audio.nudgeEpoch === handledNudgeRef.current) return;
    handledNudgeRef.current = audio.nudgeEpoch;
    readAloudStore.getState().recordEvent("visual-nudge", elapsedEventMs(), "Three-second visual nudge shown without a score penalty.");
  }, [audio.isActive, audio.nudgeEpoch, elapsedEventMs]);

  useEffect(() => {
    if (!audio.isActive || audio.interventionEpoch === 0 || audio.interventionEpoch === handledInterventionRef.current) return;
    handledInterventionRef.current = audio.interventionEpoch;
    readAloudStore.getState().recordEvent("intervention", elapsedEventMs(), `Five-second support offered for “${words[currentIndex]}”.`);
  }, [audio.interventionEpoch, audio.isActive, currentIndex, elapsedEventMs, words]);

  useEffect(() => {
    if (!audio.isActive || !telemetry || telemetry.tokens.some((token) => token.status === "pending") || audio.speechEndedEpoch === 0) return;
    const lastObservationAt = telemetry.observations.at(-1)?.atMs ?? Number.POSITIVE_INFINITY;
    const lastSpeechEndAt = telemetry.events.filter((event) => event.type === "speech-end").at(-1)?.atMs ?? -1;
    if (lastSpeechEndAt < lastObservationAt) return;
    const timer = setTimeout(() => void finishReading(), 500);
    return () => clearTimeout(timer);
  }, [audio.isActive, audio.speechEndedEpoch, finishReading, telemetry]);

  function moveBack() {
    const nextIndex = Math.max(0, currentIndex - 1);
    readAloudStore.getState().setCurrentTokenIndex(nextIndex);
    setCurrentToken(nextIndex);
  }

  function moveNextOrFinish() {
    if (currentIndex === words.length - 1) {
      void finishReading();
      return;
    }
    const nextIndex = advanceTokenIndex(currentIndex, words.length);
    readAloudStore.getState().setCurrentTokenIndex(nextIndex);
    setCurrentToken(nextIndex);
  }

  const statusText = alignmentError
    ?? audio.errorMessage
    ?? (audio.phase === "requesting-permission"
      ? "Asking for microphone permission…"
      : audio.phase === "speaking"
        ? "Listening carefully…"
        : audio.isActive
          ? "Read the sentence aloud."
          : "Tap the microphone when you are ready.");

  return (
    <main className="student-canvas flex flex-col pb-10">
      <StudentTopBar />
      <section className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-between px-9 pb-5 pt-8 sm:px-12">
        <div className="mx-auto mb-8 w-full max-w-[680px] rounded-[1.5rem] border-2 border-[var(--reader-teal)]/30 bg-white/80 p-2 shadow-sm" aria-label="Pronunciation evaluation mode" role="group">
          <div className="grid gap-2 sm:grid-cols-2">
            <button aria-pressed={state.session.evaluationMode === "standard-rp"} className={`pressable rounded-[1.1rem] px-3 py-2 text-sm font-black ${state.session.evaluationMode === "standard-rp" ? "bg-[var(--reader-gold)] text-white" : "text-[var(--reader-teal-deep)]"}`} disabled={audio.isActive || busy} onClick={() => setEvaluationMode("standard-rp")} type="button">Standard Received Pronunciation<br /><span className="font-semibold">Baseline ASR</span></button>
            <button aria-pressed={state.session.evaluationMode === "regional-restraint"} className={`pressable rounded-[1.1rem] px-3 py-2 text-sm font-black ${state.session.evaluationMode === "regional-restraint" ? "bg-[var(--reader-teal)] text-white" : "text-[var(--reader-teal-deep)]"}`} disabled={audio.isActive || busy} onClick={() => setEvaluationMode("regional-restraint")} type="button">Hiberno-English &amp; Northern Irish<br /><span className="font-semibold">Reader Leader Agent Restraint</span></button>
          </div>
          <p className="px-2 pb-1 pt-2 text-center text-xs font-black text-[var(--reader-teal-deep)]">{state.session.evaluationMode === "regional-restraint" ? "Tested regional variants are accepted before error scoring" : "Comparison mode uses the baseline pronunciation model"}</p>
        </div>
        <div className="student-card relative grid min-h-[470px] place-items-center overflow-visible px-8 py-12 text-center sm:px-16">
          <p className="font-[var(--font-reading)] text-[4rem] leading-[1.22] font-semibold tracking-[-0.045em] text-[var(--reader-teal)] sm:text-[5rem]">
            {words.map((word, index) => (
              <span key={`${word}-${index}`}>
                <span className={showHighlight && index === currentIndex ? "rounded-xl bg-[#E5A93C] px-1 text-white" : index === currentIndex && audio.isActive ? "rounded-xl bg-[var(--reader-teal-soft)] px-1" : ""}>{word}</span>{index < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          {audio.phase === "prompting" && (
            <p className="absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-4 border-white bg-[#fff0c8] px-5 py-2 text-lg font-black text-[var(--reader-gold-deep)] shadow-lg" role="status">
              {phoneticCue(words[currentIndex])}
            </p>
          )}
        </div>

        <ReadAloudStatus phase={audio.phase} recognitionSupport={telemetry?.recognitionSupport ?? recognition.support} interimTranscript={recognition.interimTranscript} recognitionMessage={recognition.errorMessage} metrics={telemetry?.metrics} />

        <div className="mt-12">
          <div className="flex items-center justify-between gap-5">
            <button aria-label="Previous target word" className="pressable text-[var(--reader-teal)]" onClick={moveBack} type="button">
              <ArrowBigLeft className="size-24 fill-current stroke-[var(--reader-gold)] stroke-[3] sm:size-28" />
            </button>
            <button aria-label={audio.isActive ? "Stop recording and finish" : "Start microphone"} className={`microphone-control pressable relative grid size-32 shrink-0 place-items-center rounded-full text-white sm:size-36 ${audio.isActive ? "is-listening bg-[#68d0a0]" : "bg-[var(--reader-teal)]"}`} disabled={busy} onClick={audio.isActive ? finishReading : startMicrophone} type="button">
              <span className="microphone-wave wave-one" /><span className="microphone-wave wave-two" />
              {busy ? <LoaderCircle className="size-16 animate-spin" /> : audio.isActive ? <Square className="size-12 fill-current" /> : <Mic className="size-16" strokeWidth={2.3} />}
            </button>
            <button aria-label={currentIndex === words.length - 1 ? "Finish this reading" : "Next target word"} className="pressable text-[var(--reader-teal)]" disabled={busy} onClick={moveNextOrFinish} type="button">
              <ArrowBigRight className="size-24 fill-current stroke-[var(--reader-gold)] stroke-[3] sm:size-28" />
            </button>
          </div>
          <p aria-live="polite" className={`mx-auto mt-8 max-w-lg text-center text-lg font-black ${alignmentError || audio.errorMessage ? "text-[var(--reader-red)]" : "text-[var(--reader-teal-deep)]"}`}>{statusText}</p>
        </div>
      </section>
    </main>
  );
}
