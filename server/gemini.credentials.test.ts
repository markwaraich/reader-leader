import { describe, expect, it } from "vitest";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

describe.skipIf(!apiKey)("Gemini server credentials", () => {
  it("authorizes access to the configured model metadata", async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey ?? "")}`,
    );

    expect(response.ok, await response.text()).toBe(true);
  }, 15_000);
});
