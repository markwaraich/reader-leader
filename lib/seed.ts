import type { AlignmentResponse, ReaderLeaderState, Story, StudentMetric, TokenAlignment } from "@/lib/domain";

/** Deterministic foundation data keeps the single-path demo coherent before persistence and production speech services are introduced. */

export const STORY_ASSETS = {
  brandMark: "/icon.svg",
} as const;

export const STORIES: Story[] = [
  { id: "fat-cat", title: "The Fat Cat", level: 1, band: "pink", bandLabel: "Level 1: Pink Band", focus: "CVC Words", targetText: "The big cat sat on the mat." },
  { id: "big-dog", title: "Big Dog", level: 1, band: "pink", bandLabel: "Level 1: Pink Band", focus: "CVC Words", targetText: "The big dog can run and hop." },
  { id: "sun-bun", title: "Sun Bun", level: 1, band: "pink", bandLabel: "Level 1: Pink Band", focus: "CVC Words", targetText: "The bun sat in the sun." },
  { id: "pig-in-mud", title: "Pig in Mud", level: 2, band: "red", bandLabel: "Level 2: Red Band", focus: "Short Vowels", targetText: "The pink pig dug in the mud." },
  { id: "red-hen", title: "Red Hen", level: 2, band: "red", bandLabel: "Level 2: Red Band", focus: "Short Vowels", targetText: "The red hen had six chicks." },
  { id: "frog-log", title: "Frog Log", level: 2, band: "red", bandLabel: "Level 2: Red Band", focus: "Short Vowels", targetText: "A green frog sat on a log." },
  { id: "bears-hat", title: "Bear's Hat", level: 3, band: "yellow", bandLabel: "Level 3: Yellow Band", focus: "Consonant Blends", targetText: "The brown bear found a bright hat." },
  { id: "ship-trip", title: "Ship Trip", level: 3, band: "yellow", bandLabel: "Level 3: Yellow Band", focus: "Consonant Blends", targetText: "The ship went on a long trip." },
  { id: "fox-box", title: "Fox Box", level: 3, band: "yellow", bandLabel: "Level 3: Yellow Band", focus: "Consonant Blends", targetText: "The quick fox hid in a box." },
  { id: "brave-knight", title: "The Brave Knight", level: 5, band: "green", bandLabel: "Level 5: Green Band", focus: "Trigraphs & Silent Letters", targetText: "The brave knight went out into the cold night to find his lost horse." },
  { id: "lost-shield", title: "The Lost Shield", level: 5, band: "green", bandLabel: "Level 5: Green Band", focus: "Trigraphs & Silent Letters", targetText: "The knight searched the castle for his lost shield." },
  { id: "kings-ring", title: "King's Ring", level: 5, band: "green", bandLabel: "Level 5: Green Band", focus: "Trigraphs & Silent Letters", targetText: "The king lost his bright ring in the long grass." },
];

export const ACCEPTED_REGIONAL_VARIANTS = [{
  token: "knight",
  phoneticDisplay: "/n-aɪ-t/",
  localeProfiles: ["en-GB", "en-IE"],
  explanation: "Correct reading: the initial ‘k’ is silent.",
  scoreImpact: false,
}, {
  token: "horse",
  phoneticDisplay: "/hɔːrs/",
  localeProfiles: ["en-IE"],
  explanation: "Accepted rhotic /r/ in Hiberno-English and Northern Irish speech.",
  scoreImpact: false,
}] as const;

const runningRecordTokens: TokenAlignment[] = "The brave knight went out into the cold night to find his lost horse."
  .split(" ")
  .map((token, index) => ({ id: `rr-token-${index}`, token, index, status: "correct", confidence: 0.98, scoreImpact: false }));

runningRecordTokens[2] = {
  ...runningRecordTokens[2], token: "knight", status: "review", confidence: 0.86, heardAs: "k-night", phoneticDisplay: "/k-n-aɪ-t/",
  explanation: "Child sounded out the silent ‘k’ (pronounced as /k-n-aɪ-t/).", scoreImpact: false,
  cueRecommendation: "Review only; do not penalise until educator judgement is confirmed.",
};

runningRecordTokens[13] = {
  ...runningRecordTokens[13], token: "horse.", status: "hesitation", confidence: 0.93,
  explanation: "Five-second hesitation before the final word.", scoreImpact: false,
  cueRecommendation: "Offer the initial /h/ cue if the pause continues.",
};

export const SEEDED_RUNNING_RECORD: AlignmentResponse = {
  sessionId: "session-jack-001", localeProfile: "en-IE", evaluationMode: "regional-restraint", restraintApplied: true, lastConfirmedTokenIndex: 13,
  tokens: runningRecordTokens, metrics: { accuracyRate: 94, wcpm: 62, elapsedSeconds: 21, falseCorrectionRate: 0 },
};

export const CLASS_STUDENTS: StudentMetric[] = [
  { id: "leo", name: "Leo Davies", bookBand: "Gold", accuracyRate: 94, wcpm: 67 },
  { id: "maya", name: "Maya Sharma", bookBand: "Silver", accuracyRate: 88, wcpm: 53 },
  { id: "ethan", name: "Ethan Chen", bookBand: "Bronze", accuracyRate: 91, wcpm: 58 },
];

export const DEFAULT_STATE: ReaderLeaderState = {
  selectedStoryId: "fat-cat",
  session: {
    id: "session-jack-001",
    studentId: "jack-murphy",
    storyId: "fat-cat",
    storySnapshot: {
      id: "fat-cat",
      title: "The Fat Cat",
      level: 1,
      band: "pink",
      bandLabel: "Level 1: Pink Band",
      focus: "CVC Words",
      targetText: "The big cat sat on the mat.",
    },
    localeProfile: "en-IE",
    evaluationMode: "regional-restraint",
    status: "ready",
    currentTokenIndex: 0,
    elapsedMs: 0,
    earnedBadges: ["great-listening", "phonics-champion", "speed-reader"],
  },
  overrides: [],
};

export function getStory(storyId: ReaderLeaderState["selectedStoryId"]): Story {
  return STORIES.find((story) => story.id === storyId) ?? STORIES[0];
}

export function getStorySnapshot(story: Story) {
  return {
    id: story.id,
    title: story.title,
    level: story.level,
    band: story.band,
    bandLabel: story.bandLabel,
    focus: story.focus,
    targetText: story.targetText,
  };
}
