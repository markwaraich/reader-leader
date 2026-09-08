"use client";

/* Educator judgement rule: a likely phonics error has a clear expected confirmation path, while a fluent override remains explicit and auditable. */
import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

export function TwoStepOverride({
  accepted,
  confirmed,
  onConfirmError,
  onOverride,
}: {
  accepted: boolean;
  confirmed: boolean;
  onConfirmError: () => void;
  onOverride: () => void;
}) {
  const [overrideArmed, setOverrideArmed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOverrideArmed(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (overrideArmed && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOverrideArmed(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [overrideArmed]);

  function handleOverrideClick() {
    if (accepted) return;
    if (!overrideArmed) {
      setOverrideArmed(true);
      return;
    }
    onOverride();
    setOverrideArmed(false);
  }

  if (accepted) {
    return (
      <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-center font-black text-emerald-800">
        <Check className="mr-2 inline size-5" />Accepted as fluent by educator
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3" ref={wrapperRef}>
      <button
        className={`pressable flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black text-white ${confirmed ? "bg-[var(--reader-red)]" : "bg-[var(--reader-teal)]"}`}
        disabled={confirmed}
        onClick={onConfirmError}
        type="button"
      >
        <Check className="size-5" />
        {confirmed ? "Phonics Error Confirmed" : "Confirm Phonics Error"}
      </button>
      <button
        aria-describedby={overrideArmed ? "override-confirmation-help" : undefined}
        className={`pressable flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-black ${overrideArmed ? "border-[var(--reader-gold-deep)] bg-[#fff5d9] text-[var(--reader-gold-deep)]" : "border-[var(--reader-teal)] bg-white text-[var(--reader-teal-deep)]"}`}
        onClick={handleOverrideClick}
        type="button"
      >
        <ShieldCheck className="size-5" />
        {overrideArmed ? "Confirm: Accept as Fluent" : "Override AI (Accept as Fluent)"}
      </button>
      {overrideArmed && (
        <div className="flex items-start gap-3 rounded-xl bg-[#fff5d9] p-3 text-sm text-[#6f4b00]" id="override-confirmation-help" role="status">
          <p className="flex-1"><strong>Click the override again to confirm.</strong> Use this only when the recording was misheard; it restores the word as fluent and creates an audit entry.</p>
          <button aria-label="Cancel override" className="pressable rounded-md p-1" onClick={() => setOverrideArmed(false)} type="button"><X className="size-5" /></button>
        </div>
      )}
    </div>
  );
}
