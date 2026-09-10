import { describe, expect, it } from "vitest";
import { DEFAULT_STATE } from "@/lib/seed";
import { loadReaderLeaderState, READER_SESSION_STORAGE_KEY, saveReaderLeaderState } from "@/lib/session-storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("Reader Leader storage v3", () => {
  it("migrates a v2 envelope without inventing telemetry", () => {
    const storage = new MemoryStorage();
    storage.setItem("reader-leader-session-v2", JSON.stringify({ version: 2, state: DEFAULT_STATE }));
    const restored = loadReaderLeaderState(storage);
    expect(restored.session.id).toBe(DEFAULT_STATE.session.id);
    expect(restored.session.telemetry).toBeUndefined();
  });

  it("round-trips v3 state and recovers from corrupt data", () => {
    const storage = new MemoryStorage();
    saveReaderLeaderState(storage, DEFAULT_STATE);
    expect(READER_SESSION_STORAGE_KEY).toBe("reader-leader-session-v3");
    expect(loadReaderLeaderState(storage).selectedStoryId).toBe("fat-cat");
    storage.setItem(READER_SESSION_STORAGE_KEY, "not-json");
    expect(loadReaderLeaderState(storage).selectedStoryId).toBe(DEFAULT_STATE.selectedStoryId);
    expect(storage.getItem(READER_SESSION_STORAGE_KEY)).toBeNull();
  });
});
