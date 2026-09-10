import { describe, expect, it } from "vitest";
import { ACCENT_INVARIANCE_FIXTURES, findAccentInvariant } from "@/lib/read-aloud/accent-invariance";

describe("accent invariance allow-list", () => {
  it.each([
    ["horse", "hoarse", undefined, "rhotic-r"],
    ["three", "tree", undefined, "dental-stop-t"],
    ["thing", "ting", undefined, "dental-stop-t"],
    ["this", "dis", undefined, "dental-stop-d"],
    ["horse", undefined, "/hɔːɹs/", "rhotic-r"],
    ["that", undefined, "[dæt]", "dental-stop-d"],
  ])("accepts %s / %s / %s only in restraint mode", (expected, observed, phonemes, feature) => {
    expect(findAccentInvariant({ expected, observed, phonemes, localeProfile: "en-IE", evaluationMode: "regional-restraint" })?.feature).toBe(feature);
    expect(findAccentInvariant({ expected, observed, phonemes, localeProfile: "en-GB", evaluationMode: "standard-rp" })).toBeNull();
  });

  it("does not turn unrelated substitutions into accent variants", () => {
    expect(findAccentInvariant({ expected: "horse", observed: "house", localeProfile: "en-IE", evaluationMode: "regional-restraint" })).toBeNull();
    expect(ACCENT_INVARIANCE_FIXTURES.every((fixture) => fixture.lexicalVariants.length > 0 && fixture.phonemeVariants.length > 0)).toBe(true);
  });
});
