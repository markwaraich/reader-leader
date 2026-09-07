"use client";

/* Reference-led rule: the library follows the supplied portrait rails, bold band labels, soft white story cards, and large rounded child-readable type. */
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useReaderSession } from "@/app/providers";
import { StoryIllustration } from "@/components/story-illustration";
import { STORIES } from "@/lib/seed";
import type { BookBandId, Story } from "@/lib/domain";

const bands: Array<{ id: BookBandId; label: string; pillClass: string; focusColour: string }> = [
  { id: "pink", label: "Level 1: Pink Band", pillClass: "bg-[var(--reader-pink)] text-white", focusColour: "#91dcef" },
  { id: "red", label: "Level 2: Red Band", pillClass: "bg-[#ff3b30] text-white", focusColour: "var(--reader-green)" },
  { id: "yellow", label: "Level 3: Yellow Band", pillClass: "bg-[var(--reader-yellow)] text-black", focusColour: "#ff9818" },
  { id: "green", label: "Level 5: Green Band", pillClass: "bg-emerald-100 text-emerald-700", focusColour: "#34a868" },
];

function StoryCard({ story, focusColour }: { story: Story; focusColour: string }) {
  const router = useRouter();
  const { selectStory } = useReaderSession();

  function openStory() {
    selectStory(story);
    router.push("/read");
  }

  return (
    <button className="student-card pressable flex w-[218px] shrink-0 flex-col items-center overflow-hidden px-4 pb-4 pt-5 text-center sm:w-[236px]" onClick={openStory} type="button">
      <span className="grid h-40 w-full place-items-center" aria-hidden="true">
        <StoryIllustration storyId={story.id} />
      </span>
      <span className="mt-2 text-[1.72rem] leading-tight font-black text-black">{story.title}</span>
      <span className="mt-3 rounded-full px-3 py-1.5 text-[0.95rem] leading-none font-extrabold text-white" style={{ backgroundColor: focusColour, color: story.band === "pink" ? "#062333" : "white" }}>
        Focus: {story.focus}
      </span>
    </button>
  );
}

export function StoryLibrary() {
  return (
    <main className="student-canvas overflow-hidden pb-16">
      <div className="mx-auto max-w-[860px]">
        <header className="relative px-5 pb-5 pt-10 sm:px-10">
          <button aria-label="Go back" className="pressable absolute left-4 top-9 text-[var(--reader-teal)] sm:left-8" onClick={() => window.history.back()} type="button">
            <ChevronLeft className="size-14" strokeWidth={2.3} />
          </button>
          <h1 className="text-center text-[2.65rem] leading-tight font-black tracking-[-0.04em] text-[var(--reader-teal)] sm:text-[3.3rem]">Choose Your Story</h1>
        </header>

        <div className="space-y-12 pt-6 sm:space-y-14">
          {bands.map((band) => (
            <section key={band.id} aria-labelledby={`band-${band.id}`}>
              <h2 className={`ml-10 inline-flex rounded-full px-4 py-1.5 text-[1.55rem] leading-none font-black shadow-sm sm:ml-12 sm:text-[1.8rem] ${band.pillClass}`} id={`band-${band.id}`}>
                {band.label}
              </h2>
              <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-10 pb-4 sm:gap-5 sm:px-12">
                {STORIES.filter((story) => story.band === band.id).map((story) => <StoryCard focusColour={band.focusColour} key={story.id} story={story} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
