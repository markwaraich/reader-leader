import type { AccentProfile, EvaluationMode } from "@/lib/domain";
import { normalizeWord } from "@/lib/read-aloud/transcript-normalization";

export interface AccentInvariantFixture {
  id: string;
  localeProfiles: AccentProfile[];
  target: string;
  lexicalVariants: string[];
  phonemeVariants: string[];
  feature: "rhotic-r" | "dental-stop-t" | "dental-stop-d";
  explanation: string;
}

export const ACCENT_INVARIANCE_VERSION = 1 as const;

/**
 * Deliberately narrow fixtures. New variants require a recorded example and a
 * regression test; this table must never become a general fuzzy-match escape.
 */
export const ACCENT_INVARIANCE_FIXTURES: AccentInvariantFixture[] = [
  {
    id: "en-ie-horse-rhotic",
    localeProfiles: ["en-IE"],
    target: "horse",
    lexicalVariants: ["horse", "hoarse"],
    phonemeVariants: ["hɔɹs", "hɔːɹs", "hɔrs", "hɔːrs"],
    feature: "rhotic-r",
    explanation: "Accepted rhotic /r/ in Hiberno-English and Northern Irish speech.",
  },
  {
    id: "en-ie-three-dental-stop",
    localeProfiles: ["en-IE"],
    target: "three",
    lexicalVariants: ["tree"],
    phonemeVariants: ["triː", "tɹiː"],
    feature: "dental-stop-t",
    explanation: "Accepted dental-stop [t] realization of /θ/.",
  },
  {
    id: "en-ie-thing-dental-stop",
    localeProfiles: ["en-IE"],
    target: "thing",
    lexicalVariants: ["ting"],
    phonemeVariants: ["tɪŋ"],
    feature: "dental-stop-t",
    explanation: "Accepted dental-stop [t] realization of /θ/.",
  },
  {
    id: "en-ie-think-dental-stop",
    localeProfiles: ["en-IE"],
    target: "think",
    lexicalVariants: ["tink"],
    phonemeVariants: ["tɪŋk"],
    feature: "dental-stop-t",
    explanation: "Accepted dental-stop [t] realization of /θ/.",
  },
  {
    id: "en-ie-this-dental-stop",
    localeProfiles: ["en-IE"],
    target: "this",
    lexicalVariants: ["dis"],
    phonemeVariants: ["dɪs"],
    feature: "dental-stop-d",
    explanation: "Accepted dental-stop [d] realization of /ð/.",
  },
  {
    id: "en-ie-that-dental-stop",
    localeProfiles: ["en-IE"],
    target: "that",
    lexicalVariants: ["dat"],
    phonemeVariants: ["dat", "dæt"],
    feature: "dental-stop-d",
    explanation: "Accepted dental-stop [d] realization of /ð/.",
  },
  {
    id: "en-ie-them-dental-stop",
    localeProfiles: ["en-IE"],
    target: "them",
    lexicalVariants: ["dem"],
    phonemeVariants: ["dɛm"],
    feature: "dental-stop-d",
    explanation: "Accepted dental-stop [d] realization of /ð/.",
  },
];

function normalizePhonemes(value: string): string {
  return value.toLocaleLowerCase("en-GB").replace(/[\/\[\]\s._-]+/g, "");
}

export function findAccentInvariant(input: {
  expected: string;
  observed?: string;
  phonemes?: string;
  localeProfile: AccentProfile;
  evaluationMode: EvaluationMode;
}): AccentInvariantFixture | null {
  if (input.evaluationMode !== "regional-restraint") return null;
  const expected = normalizeWord(input.expected);
  const observed = input.observed ? normalizeWord(input.observed) : "";
  const phonemes = input.phonemes ? normalizePhonemes(input.phonemes) : "";

  return ACCENT_INVARIANCE_FIXTURES.find((fixture) => {
    if (!fixture.localeProfiles.includes(input.localeProfile) || fixture.target !== expected) return false;
    const lexicalMatch = observed.length > 0 && fixture.lexicalVariants.some((variant) => normalizeWord(variant) === observed);
    const phonemeMatch = phonemes.length > 0 && fixture.phonemeVariants.some((variant) => normalizePhonemes(variant) === phonemes);
    return lexicalMatch || phonemeMatch;
  }) ?? null;
}
