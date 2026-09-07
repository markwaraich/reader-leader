"use client";

/* Reference-led rule: the reading canvas retains one dominant sentence, a thumb-zone microphone, and restrained amber support rather than punitive feedback. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigLeft, ArrowBigRight, LoaderCircle, Mic, Square } from "lucide-react";
import { StudentTopBar } from "@/components/student-top-bar";
import { useReaderSession } from "@/app/providers";
import { useHesitationFSM } from "@/hooks/use-hesitation-fsm";
import { alignSpeech } from "@/lib/speech-alignment-client";
import { advanceTokenIndex, INITIAL_TOKEN_INDEX, shouldAutoFinishReading, shouldShowBaselineInterrupt, shouldSuppressFinalHesitation } from "@/lib/hesitation-fsm";
import { ATTEMPT_SNIPPET_DURATION_MS, ATTEMPT_SNIPPET_PRE_ROLL_MS, blobToAudioDataUri } from "@/lib/audio-data";

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
  const audio = useHesitationFSM();
  const [alignmentError, setAlignmentError] = useState<string | null>(null);
  const handledSpeechStartRef = useRef(0);
  const handledSpeechEndRef = useRef(0);
  const finalTokenSpokenRef = useRef(false);
  const finishingRef = useRef(false);
  const snippetRequestedRef = useRef(false);
  const preparedStoryRef = useRef<string | null>(null);
  const story = state.session.storySnapshot;
  const words = story.targetText.split(/\s+/);
  const currentIndex = Math.min(state.session.currentTokenIndex, words.length - 1);
  const baselineInterrupt = shouldShowBaselineInterrupt(state.session.evaluationMode, words[currentIndex], audio.isActive, audio.silenceMs);
  const suppressFinalHesitation = shouldSuppressFinalHesitation(state.session.evaluationMode, currentIndex, words.length);
  const showHighlight = (!suppressFinalHesitation && (audio.phase === "hesitating" || audio.phase === "prompting")) || baselineInterrupt;
  const busy = !hydrated || audio.phase === "requesting-permission" || audio.phase === "finishing" || state.session.status === "aligning";

  const resetAttemptRefs = useCallback(() => {
    handledSpeechStartRef.current = 0;
    handledSpeechEndRef.current = 0;
    finalTokenSpokenRef.current = false;
    finishingRef.current = false;
    snippetRequestedRef.current = false;
  }, []);

  useEffect(() => {
    if (!hydrated || preparedStoryRef.current === story.id) return;
    preparedStoryRef.current = story.id;
    audio.cancel();
    resetAttemptRefs();
    prepareReadingAttempt();
  }, [audio, hydrated, prepareReadingAttempt, resetAttemptRefs, story.id]);

  async function startMicrophone() {
    setCurrentToken(INITIAL_TOKEN_INDEX);
    audio.cancel();
    resetAttemptRefs();
    const started = await audio.start();
    if (started) startReading();
  }

  const finishReading = useCallback(async () => {
    if (busy || finishingRef.current) return;
    finishingRef.current = true;
    setAlignmentError(null);
    try {
      const capture = audio.isActive ? await audio.finish() : { blob: null, chunks: [], snippetBlob: null, elapsedMs: Math.max(state.session.elapsedMs, 5_000) };
      beginAlignment(capture.elapsedMs);
      const alignment = await alignSpeech({
        sessionId: state.session.id,
        storyId: story.id,
        targetText: story.targetText,
        localeProfile: state.session.localeProfile,
        evaluationMode: state.session.evaluationMode,
        elapsedMs: capture.elapsedMs,
        isFinal: true,
        currentTokenIndex: currentIndex,
        targetToken: capture.snippetBlob && story.id === "brave-knight" ? "knight" : undefined,
        demoAttempt: story.id === "brave-knight" ? "sounded-silent-k" : "standard",
      }, capture.snippetBlob);
      const knightIndex = words.findIndex((word) => stripPunctuation(word) === "knight");
      const attemptSnippet = capture.snippetBlob && knightIndex >= 0 ? {
        token: "knight",
        tokenIndex: knightIndex,
        dataUri: await blobToAudioDataUri(capture.snippetBlob),
        mimeType: capture.snippetBlob.type || "audio/webm",
        durationMs: ATTEMPT_SNIPPET_DURATION_MS,
      } : undefined;
      completeReading(alignment, capture.elapsedMs, attemptSnippet);
      router.push("/celebrate");
    } catch {
      setAlignmentError("We could not make the running record. Please try finishing again.");
      finishingRef.current = false;
    }
  }, [audio, beginAlignment, busy, completeReading, currentIndex, router, state.session.elapsedMs, state.session.evaluationMode, state.session.id, state.session.localeProfile, story.id, story.targetText, words]);

  useEffect(() => {
    if (!audio.isActive || audio.speechStartedEpoch === 0 || audio.speechStartedEpoch === handledSpeechStartRef.current) return;
    handledSpeechStartRef.current = audio.speechStartedEpoch;
    if (stripPunctuation(words[currentIndex]) === "knight" && !snippetRequestedRef.current) {
      snippetRequestedRef.current = true;
      audio.captureSnippet(audio.speechStartedAtMs, ATTEMPT_SNIPPET_DURATION_MS, ATTEMPT_SNIPPET_PRE_ROLL_MS);
    }
    if (currentIndex === words.length - 1) finalTokenSpokenRef.current = false;
  }, [audio, currentIndex, words]);

  useEffect(() => {
    if (!audio.isActive || audio.speechEndedEpoch === 0 || audio.speechEndedEpoch === handledSpeechEndRef.current) return;
    handledSpeechEndRef.current = audio.speechEndedEpoch;
    if (currentIndex === words.length - 1) {
      finalTokenSpokenRef.current = true;
      if (state.session.evaluationMode === "regional-restraint") audio.clearHesitation();
      return;
    }
    setCurrentToken(advanceTokenIndex(currentIndex, words.length));
  }, [audio, currentIndex, setCurrentToken, state.session.evaluationMode, words.length]);

  useEffect(() => {
    if (shouldAutoFinishReading(currentIndex, words.length, finalTokenSpokenRef.current, audio.silenceMs, state.session.evaluationMode)) void finishReading();
  }, [audio.silenceMs, currentIndex, finishReading, state.session.evaluationMode, words.length]);

  function moveBack() {
    finalTokenSpokenRef.current = false;
    setCurrentToken(Math.max(0, currentIndex - 1));
  }

  function moveNextOrFinish() {
    if (currentIndex === words.length - 1) {
      void finishReading();
      return;
    }
    finalTokenSpokenRef.current = false;
    setCurrentToken(advanceTokenIndex(currentIndex, words.length));
  }

  const statusText = alignmentError
    ?? audio.errorMessage
    ?? (baselineInterrupt ? "Baseline ASR interrupt: regional rhotic ‘horse’ flagged as a substitution." : null)
    ?? (audio.phase === "requesting-permission"
      ? "Asking for microphone permission…"
      : audio.phase === "speaking"
        ? "Listening carefully…"
        : audio.phase === "hesitating"
          ? "Take your time."
          : audio.phase === "prompting"
            ? "Here is a little sound clue."
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
          <p className="px-2 pb-1 pt-2 text-center text-xs font-black text-[var(--reader-teal-deep)]">{state.session.evaluationMode === "regional-restraint" ? "Restraint as a feature · false-correction target 0.0%" : "Comparison mode · regional rhotic speech receives an amber interrupt"}</p>
        </div>
        <div className="student-card relative grid min-h-[470px] place-items-center overflow-visible px-8 py-12 text-center sm:px-16">
          <p className="font-[var(--font-reading)] text-[4rem] leading-[1.22] font-semibold tracking-[-0.045em] text-[var(--reader-teal)] sm:text-[5rem]">
            {words.map((word, index) => (
              <span key={`${word}-${index}`}>
                <span className={showHighlight && index === currentIndex ? "rounded-xl bg-[#E5A93C] px-1 text-white" : ""}>{word}</span>{index < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          {audio.phase === "prompting" && !suppressFinalHesitation && (
            <p className="absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-4 border-white bg-[#fff0c8] px-5 py-2 text-lg font-black text-[var(--reader-gold-deep)] shadow-lg" role="status">
              {phoneticCue(words[currentIndex])}
            </p>
          )}
          {baselineInterrupt && audio.phase !== "prompting" && (
            <p className="absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-4 border-white bg-[#fff0c8] px-5 py-2 text-lg font-black text-[var(--reader-gold-deep)] shadow-lg" role="alert">Baseline ASR interruption</p>
          )}
        </div>

        <div className="mt-24">
          <div className="flex items-center justify-between gap-5">
            <button aria-label="Previous target word" className="pressable text-[var(--reader-teal)]" onClick={moveBack} type="button">
              <ArrowBigLeft className="size-24 fill-current stroke-[var(--reader-gold)] stroke-[3] sm:size-28" />
            </button>
            <button
              aria-label={audio.isActive ? "Stop recording and finish" : "Start microphone"}
              className={`microphone-control pressable relative grid size-32 shrink-0 place-items-center rounded-full text-white sm:size-36 ${audio.isActive ? "is-listening bg-[#68d0a0]" : "bg-[var(--reader-teal)]"}`}
              disabled={busy}
              onClick={audio.isActive ? finishReading : startMicrophone}
              type="button"
            >
              <span className="microphone-wave wave-one" /><span className="microphone-wave wave-two" />
              {busy ? <LoaderCircle className="size-16 animate-spin" /> : audio.isActive ? <Square className="size-12 fill-current" /> : <Mic className="size-16" strokeWidth={2.3} />}
            </button>
            <button aria-label={currentIndex === words.length - 1 ? "Finish this reading" : "Next target word"} className="pressable text-[var(--reader-teal)]" disabled={busy} onClick={moveNextOrFinish} type="button">
              <ArrowBigRight className="size-24 fill-current stroke-[var(--reader-gold)] stroke-[3] sm:size-28" />
            </button>
          </div>
          <p aria-live="polite" className={`mx-auto mt-12 max-w-lg text-center text-lg font-black ${alignmentError || audio.errorMessage ? "text-[var(--reader-red)]" : "text-[var(--reader-teal-deep)]"}`}>{statusText}</p>
        </div>
      </section>
    </main>
  );
}
