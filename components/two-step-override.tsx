"use client";

/* Educator judgement rule: likely classifications have clear primary actions, while AI overrides can require an explicit second confirmation. */
import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

export function TwoStepOverride({
  accepted,
  acceptedLabel,
  primaryLabel,
  primaryConfirmedLabel,
  primaryConfirmed,
  onPrimary,
  secondaryLabel,
  secondaryConfirmLabel,
  secondaryConfirmedLabel,
  secondaryConfirmed = false,
  secondaryRequiresConfirmation = true,
  onSecondary,
}: {
  accepted: boolean;
  acceptedLabel: string;
  primaryLabel: string;
  primaryConfirmedLabel: string;
  primaryConfirmed: boolean;
  onPrimary: () => void;
  secondaryLabel: string;
  secondaryConfirmLabel: string;
  secondaryConfirmedLabel?: string;
  secondaryConfirmed?: boolean;
  secondaryRequiresConfirmation?: boolean;
  onSecondary: () => void;
}) {
  const [secondaryArmed, setSecondaryArmed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSecondaryArmed(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (secondaryArmed && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setSecondaryArmed(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [secondaryArmed]);

  function handleSecondaryClick() {
    if (secondaryConfirmed) return;
    if (secondaryRequiresConfirmation && !secondaryArmed) {
      setSecondaryArmed(true);
      return;
    }
    onSecondary();
    setSecondaryArmed(false);
  }

  if (accepted) {
    return (
      <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-center font-black text-emerald-800">
        <Check className="mr-2 inline size-5" />{acceptedLabel}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3" ref={wrapperRef}>
      <button
        className={`pressable flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black text-white ${primaryConfirmed ? "bg-[var(--reader-red)]" : "bg-[var(--reader-teal)]"}`}
        disabled={primaryConfirmed}
        onClick={onPrimary}
        type="button"
      >
        <Check className="size-5" />
        {primaryConfirmed ? primaryConfirmedLabel : primaryLabel}
      </button>
      <button
        aria-describedby={secondaryArmed ? "secondary-confirmation-help" : undefined}
        className={`pressable flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-black ${secondaryConfirmed ? "border-[var(--reader-red)] bg-red-50 text-[var(--reader-red)]" : secondaryArmed ? "border-[var(--reader-gold-deep)] bg-[#fff5d9] text-[var(--reader-gold-deep)]" : "border-[var(--reader-teal)] bg-white text-[var(--reader-teal-deep)]"}`}
        disabled={secondaryConfirmed}
        onClick={handleSecondaryClick}
        type="button"
      >
        <ShieldCheck className="size-5" />
        {secondaryConfirmed ? secondaryConfirmedLabel : secondaryArmed ? secondaryConfirmLabel : secondaryLabel}
      </button>
      {secondaryArmed && (
        <div className="flex items-start gap-3 rounded-xl bg-[#fff5d9] p-3 text-sm text-[#6f4b00]" id="secondary-confirmation-help" role="status">
          <p className="flex-1"><strong>Click again to confirm.</strong> This restores the word as fluent and creates an educator audit entry.</p>
          <button aria-label="Cancel decision" className="pressable rounded-md p-1" onClick={() => setSecondaryArmed(false)} type="button"><X className="size-5" /></button>
        </div>
      )}
    </div>
  );
}
