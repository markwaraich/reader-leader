import { Ear, Gauge, LifeBuoy, RotateCw } from "lucide-react";
import type { HesitationMachine, ReadingMetrics, RecognitionSupport } from "@/lib/domain";

interface ReadAloudStatusProps {
  phase: HesitationMachine["phase"];
  recognitionSupport: RecognitionSupport;
  interimTranscript: string;
  recognitionMessage?: string | null;
  metrics?: ReadingMetrics;
}

export function ReadAloudStatus({ phase, recognitionSupport, interimTranscript, recognitionMessage, metrics }: ReadAloudStatusProps) {
  const nudge = phase === "hesitating";
  const intervention = phase === "prompting";
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" aria-label="Live read-aloud status">
      <div className={`rounded-2xl border px-4 py-3 ${intervention ? "border-amber-400 bg-amber-50" : nudge ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white/80"}`} aria-live="polite">
        <div className="flex items-center gap-2 font-black text-[var(--reader-teal-deep)]">
          {intervention ? <LifeBuoy className="size-5" /> : recognitionSupport === "available" ? <Ear className="size-5" /> : <RotateCw className="size-5" />}
          {intervention ? "Let’s try the first sound together." : nudge ? "Take your time. Look at the word when you’re ready." : recognitionSupport === "available" ? "Listening for each word" : "Manual reading mode"}
        </div>
        {interimTranscript && <p className="mt-1 text-sm text-slate-600">Hearing: “{interimTranscript}”</p>}
        {recognitionMessage && <p className="mt-1 text-sm text-slate-600">{recognitionMessage}</p>}
      </div>
      {metrics && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-black text-[var(--reader-teal-deep)]" aria-label="Live reading metrics">
          <Gauge className="size-5" />
          <span>{metrics.accuracyRate}% accuracy</span>
          <span>{metrics.wcpm} WCPM</span>
        </div>
      )}
    </section>
  );
}
