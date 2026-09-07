/* Reference-led rule: celebration centres the smiling gold star, oversized teal praise, and three simple achievement badges on warm cream. */
import Link from "next/link";
import { Ear, Languages, Zap } from "lucide-react";
import { StudentTopBar } from "@/components/student-top-bar";
import { CelebrationStar } from "@/components/celebration-star";
import { SessionOutcomePill } from "@/components/session-outcome-pill";

export const metadata = { title: "Brilliant Reading" };
const badges = [{ label: "Great Listening", icon: Ear, tone: "teal" }, { label: "Phonics Champion", icon: Languages, tone: "gold" }, { label: "Speed Reader", icon: Zap, tone: "teal" }] as const;

export default function CelebratePage() {
  return (
    <main className="student-canvas pb-10">
      <StudentTopBar filledStars={5} />
      <section className="mx-auto flex max-w-[760px] flex-col items-center px-8 pt-14 text-center sm:px-12">
        <CelebrationStar />
        <h1 className="mt-4 text-[4.2rem] leading-[1.08] font-black tracking-[-0.05em] text-[var(--reader-teal-deep)] sm:text-[5rem]">Brilliant<br />Reading!</h1>
        <SessionOutcomePill />
        <div className="mt-14 grid w-full grid-cols-3 gap-3">
          {badges.map(({ label, icon: Icon, tone }) => {
            const gold = tone === "gold";
            return <div className={gold ? "text-[var(--reader-gold-deep)]" : "text-[var(--reader-teal-deep)]"} key={label}>
              <div className={`mx-auto grid size-28 place-items-center rounded-full border-[7px] ${gold ? "border-[var(--reader-gold)] bg-[#fee4a0]" : "border-[var(--reader-teal)] bg-[var(--reader-teal-soft)]"}`}><Icon className="size-14" strokeWidth={2.3} /></div>
              <p className="mt-3 text-xl leading-tight font-black sm:text-2xl">{label}</p>
            </div>;
          })}
        </div>
        <div className="mt-16 grid w-full grid-cols-2 gap-5">
          <Link className="pressable rounded-[2rem] bg-[var(--reader-teal)] px-4 py-7 text-2xl font-black text-white shadow-[0_9px_0_var(--reader-teal-deep)]" href="/read">Read Again</Link>
          <Link className="pressable rounded-[2rem] bg-[var(--reader-gold)] px-4 py-7 text-2xl font-black text-white shadow-[0_9px_0_var(--reader-gold-deep)]" href="/">Choose a New Book</Link>
        </div>
        <Link className="pressable mt-9 text-lg font-black text-[var(--reader-teal-deep)] underline decoration-2 underline-offset-4" href="/dashboard/student">View Educator Record</Link>
      </section>
    </main>
  );
}
