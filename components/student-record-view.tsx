"use client";

/* Educator evidence rule: hydrate the latest completed session while preserving the supplied wide running-record and phonics-history composition. */
import { BrandMark } from "@/components/brand-mark";
import { EducatorBottomNav } from "@/components/educator-bottom-nav";
import { RunningRecord } from "@/components/running-record";
import { useReaderSession } from "@/app/providers";
import { SEEDED_RUNNING_RECORD } from "@/lib/seed";

export function StudentRecordView() {
  const { state } = useReaderSession();
  const hasLatestRecord = Boolean(state.session.alignment);
  const alignment = state.session.alignment ?? SEEDED_RUNNING_RECORD;
  const bandLabel = hasLatestRecord ? state.session.storySnapshot.bandLabel : "Level 5: Green Book Band";
  const latestDecision = state.overrides.filter((event) => event.sessionId === alignment.sessionId).at(-1);
  const introductoryRecord = hasLatestRecord && state.session.storySnapshot.level <= 3;
  const introductoryFocus = state.session.storySnapshot.focus.toLowerCase();

  return (
    <main className="educator-canvas px-5 pt-6 sm:px-8"><div className="mx-auto max-w-[1360px]">
      <header className="border-b border-slate-300 pb-5"><p className="flex items-center gap-2 text-2xl font-medium"><BrandMark className="size-9" />Reader Leader</p><h1 className="mt-1 text-[2.25rem] leading-tight font-black tracking-[-0.035em] sm:text-[2.85rem]">Student Profile &amp; Running Record</h1></header>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 py-5"><div className="flex flex-wrap items-center gap-4"><h2 className="text-3xl font-black">Jack Murphy</h2><span className="rounded-full bg-[#d7f1dd] px-4 py-2 text-lg text-[#235f2e]">{bandLabel}</span></div><button className="pressable rounded-xl bg-[var(--reader-teal)] px-5 py-3 text-lg text-white" onClick={() => window.print()} type="button">Export for Parent-Teacher Meeting</button></div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <RunningRecord alignment={alignment} />
        <aside className="educator-card p-6"><h2 className="text-2xl font-black">Phonics Assessment History</h2><ol className="mt-8 space-y-9 border-l-4 border-slate-200 pl-6 text-lg">
          {latestDecision && <li><strong>Just now</strong><span className="mt-1 block">{latestDecision.nextStatus === "confirmed-phonics-error" ? "Silent consonant intervention required" : "Teacher overrode AI and accepted ‘knight’ as fluent"}</span><span className="mt-1 block text-sm text-slate-500">{new Date(latestDecision.createdAt).toLocaleString("en-GB")}</span></li>}
          {introductoryRecord ? <>
            <li><strong>Today</strong><span className="mt-1 block">Practising {introductoryFocus} and short vowels</span></li>
            <li><strong>1 Week Ago</strong><span className="mt-1 block">Built confidence blending simple words</span></li>
            <li><strong>3 Weeks Ago</strong><span className="mt-1 block">Started an introductory phonics reading sequence</span></li>
          </> : <>
            <li><strong>Today</strong><span className="mt-1 block">Reviewed sounded silent ‘k’ in “knight”</span></li>
            <li><strong>1 Week Ago</strong><span className="mt-1 block">Mastered split digraph ‘i-e’</span></li>
            <li><strong>3 Weeks Ago</strong><span className="mt-1 block">Moved from Blue to Green Book Band</span></li>
          </>}
        </ol></aside>
      </div>
      <EducatorBottomNav active="students" />
    </div></main>
  );
}
