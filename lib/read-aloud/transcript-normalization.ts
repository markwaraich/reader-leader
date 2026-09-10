/** Canonical transcript normalization is shared by browser alignment and server policy checks. */
export function normalizeWord(value: string): string {
  return value
    .toLocaleLowerCase("en-GB")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z']/g, "")
    .replace(/^'+|'+$/g, "");
}

export function tokenizeTranscript(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

export function targetTokens(value: string): Array<{ token: string; normalizedToken: string; index: number }> {
  return value.trim().split(/\s+/).map((token, index) => ({
    token,
    normalizedToken: normalizeWord(token),
    index,
  }));
}
