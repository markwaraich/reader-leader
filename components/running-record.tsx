"use client";

/* Educator evidence rule: render token-level evidence faithfully, distinguish provisional review from teacher acceptance, and never infer penalties from colour alone. */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CirclePlay, X } from "lucide-react";
import { useReaderSession } from "@/app/providers";
import { TwoStepOverride } from "@/components/two-step-override";
import { audioDataUriToBlob } from "@/lib/audio-data";
import type { AlignmentResponse, TokenAlignment } from "@/lib/domain";

const interactiveStatuses = new Set(["review", "substitution", "omission", "confirmed-phonics-error", "accepted-teacher-override"]);

function tokenClass(token: TokenAlignment): string {
  if (token.status === "accepted-teacher-override") return "rounded-lg bg-emerald-100 px-1 text-emerald-800";
  if (["review", "substitution", "omission", "confirmed-phonics-error"].includes(token.status)) return "text-[var(--reader-red)] underline decoration-dotted decoration-[3px] underline-offset-[10px]";
  if (token.status === "hesitation") return "rounded-lg bg-[var(--reader-amber)] px-1";
  return "";
}

export function RunningRecord({ alignment }: { alignment: AlignmentResponse }) {
  const { state, confirmPhonicsError, confirmOverride } = useReaderSession();
  const [openTokenId, setOpenTokenId] = useState<string | null>(null);
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const openToken = alignment.tokens.find((token) => token.id === openTokenId) ?? null;
  const accepted = openToken?.status === "accepted-teacher-override";
  const confirmed = openToken?.status === "confirmed-phonics-error";
  const snippetDataUri = state.session.attemptSnippet?.dataUri;
  const activeSessionHasOverride = state.overrides.some((event) => event.sessionId === alignment.sessionId && event.nextStatus === "accepted-teacher-override");

  const releasePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePlayback, [releasePlayback, snippetDataUri]);

  async function playAttempt() {
    releasePlayback();
    const snippet = state.session.attemptSnippet;
    if (!snippet) {
      setPlaybackMessage("No retained audio is available for this seeded demonstration record.");
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(audioDataUriToBlob(snippet.dataUri));
      const audio = new Audio(objectUrl);
      objectUrlRef.current = objectUrl;
      audioRef.current = audio;
      audio.onended = () => {
        releasePlayback();
        setPlaybackMessage("Attempt playback complete.");
      };
      audio.onerror = () => {
        releasePlayback();
        setPlaybackMessage("This browser could not play the retained attempt.");
      };
      setPlaybackMessage("Playing the retained two-second attempt…");
      await audio.play();
    } catch {
      releasePlayback();
      setPlaybackMessage("This browser could not play the retained attempt.");
    }
  }

  function confirmErrorDecision() {
    if (!openToken) return;
    confirmPhonicsError(openToken.id, "Educator confirmed the sounded silent ‘k’ as a phonics error requiring intervention.");
  }

  function overrideAsFluent() {
    if (!openToken) return;
    confirmOverride(openToken.id, "Educator determined the child read ‘knight’ fluently and the AI misheard the attempt.");
  }

  return (
    <section className="educator-card min-h-[430px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black">Running Record</h2>
        <div className="flex gap-3 text-sm font-black">
          <span className="rounded-full bg-[var(--reader-aqua)] px-3 py-1.5">Accuracy {alignment.metrics.accuracyRate}%</span>
          <span className="rounded-full bg-[var(--reader-mint)] px-3 py-1.5">{alignment.metrics.wcpm} WCPM</span>
          <span className="rounded-full bg-[#fff0c8] px-3 py-1.5">False corrections {alignment.metrics.falseCorrectionRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="mt-20 text-[2.4rem] leading-[1.9] tracking-[-0.03em] sm:text-[3.25rem]">
        {alignment.tokens.map((token, index) => {
          const interactive = interactiveStatuses.has(token.status);
          return (
            <span key={token.id}>
              {interactive ? (
                <button
                  aria-expanded={openTokenId === token.id}
                  aria-haspopup="dialog"
                  className={`pressable relative inline [font:inherit] ${tokenClass(token)}`}
                  onClick={() => {
                    setPlaybackMessage(null);
                    setOpenTokenId((current) => current === token.id ? null : token.id);
                  }}
                  type="button"
                >
                  {token.token}
                </button>
              ) : <span className={tokenClass(token)}>{token.token}</span>}
              {index < alignment.tokens.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {openToken && (
        <div aria-label={`Review ${openToken.token}`} className="mt-8 max-w-xl rounded-2xl border border-slate-300 bg-white p-5 text-base text-black shadow-lg" role="dialog">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-black">{accepted || confirmed ? "Educator decision recorded" : `Review “${openToken.token.replace(/[.,!?]/g, "")}”`}</p>
              <p className="mt-2">Spoken as: <strong>{openToken.phoneticDisplay ?? openToken.heardAs ?? "Not available"}</strong> ({openToken.explanation ?? "Pronunciation evidence available for review."})</p>
              <p className={`mt-2 text-sm font-black ${accepted ? "text-emerald-700" : confirmed ? "text-[var(--reader-red)]" : "text-[var(--reader-teal-deep)]"}`}>
                {accepted
                  ? "Accepted as fluent by teacher override · no score penalty"
                  : confirmed
                    ? "Confirmed: Sounded silent 'k'"
                    : "Provisional phonics error · included in accuracy until reviewed"}
              </p>
            </div>
            <button aria-label="Close pronunciation review" className="pressable rounded-lg p-1 text-slate-500" onClick={() => setOpenTokenId(null)} type="button"><X className="size-5" /></button>
          </div>

          {openToken.token.toLowerCase().replace(/[^a-z']/g, "") === "knight" && <>
            <button aria-label="Play the retained two-second attempt" className="pressable mt-4 flex items-center gap-2 font-black text-[var(--reader-teal-deep)]" onClick={() => void playAttempt()} type="button">
              <CirclePlay className="size-6" /> Listen to Attempt (2s)
            </button>
            {playbackMessage && <p aria-live="polite" className="mt-2 text-sm text-slate-600">{playbackMessage}</p>}
          </>}
          <TwoStepOverride accepted={accepted} confirmed={confirmed} onConfirmError={confirmErrorDecision} onOverride={overrideAsFluent} />
        </div>
      )}

      {activeSessionHasOverride && (
        <div className="mt-8 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900" role="status">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <p><strong>Teacher override saved.</strong> The latest audit entry is stored locally with the original and accepted classifications.</p>
        </div>
      )}
    </section>
  );
}
