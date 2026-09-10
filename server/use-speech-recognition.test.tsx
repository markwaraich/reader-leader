/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  lang = "";
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }
}

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: FakeRecognition });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("automatically restarts after onend while reading remains active", () => {
    const onRestart = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ localeProfile: "en-IE", onObservation: vi.fn(), onRestart }));
    act(() => expect(result.current.start()).toBe(true));
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(FakeRecognition.instances[0].continuous).toBe(true);
    expect(FakeRecognition.instances[0].interimResults).toBe(true);
    act(() => FakeRecognition.instances[0].onend?.(new Event("end")));
    act(() => vi.advanceTimersByTime(250));
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(onRestart).toHaveBeenCalledOnce();

    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(1_000));
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it("does not reconnect after a terminal permission error", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ localeProfile: "en-IE", onObservation: vi.fn(), onError }));
    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "not-allowed" } as SpeechRecognitionErrorEvent));
    act(() => FakeRecognition.instances[0].onend?.(new Event("end")));
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.support).toBe("failed");
    expect(result.current.isActive).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(onError).toHaveBeenCalledOnce();
  });
});
