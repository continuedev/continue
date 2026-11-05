import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdownNow } from "./useCountdownNow";

const T0 = new Date("2026-11-03T12:00:00Z").getTime();

/**
 * Advances the clock in separate act() calls. One big advance would fire only
 * the first timeout: React schedules the next one when act() exits, as a
 * browser does between tasks.
 */
function advance(totalMs: number, stepMs = 1000) {
  for (let done = 0; done < totalMs; done += stepMs) {
    act(() => {
      vi.advanceTimersByTime(Math.min(stepMs, totalMs - done));
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useCountdownNow", () => {
  it("runs no timer without an expiry", () => {
    const { result } = renderHook(() => useCountdownNow(undefined));
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(T0);
  });

  it("runs no timer while disabled", () => {
    renderHook(() => useCountdownNow(T0 + 5 * 60_000, false));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ticks once a minute while more than ten minutes are left", () => {
    const { result } = renderHook(() => useCountdownNow(T0 + 30 * 60_000));
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current - T0).toBe(60_000);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current - T0).toBe(120_000);
  });

  it("ticks every second in the last ten minutes", () => {
    const { result } = renderHook(() => useCountdownNow(T0 + 5 * 60_000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current - T0).toBe(1000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current - T0).toBe(2000);
  });

  it("wakes once after expiry and then stops", () => {
    const { result } = renderHook(() => useCountdownNow(T0 + 2000));
    advance(2100, 100);
    expect(result.current).toBeGreaterThan(T0 + 2000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops its timer when it unmounts", () => {
    const view = renderHook(() => useCountdownNow(T0 + 5 * 60_000));
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("catches up and restarts when a new expiry arrives", () => {
    const view = renderHook(({ at }) => useCountdownNow(at), {
      initialProps: { at: (T0 + 2000) as number | undefined },
    });
    advance(5000, 100);
    expect(vi.getTimerCount()).toBe(0);
    view.rerender({ at: T0 + 5000 + 5 * 60_000 });
    expect(view.result.current).toBe(T0 + 5000);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("starts again after being disabled", () => {
    const at = T0 + 5 * 60_000;
    const view = renderHook(({ on }) => useCountdownNow(at, on), {
      initialProps: { on: false },
    });
    vi.setSystemTime(T0 + 30_000);
    view.rerender({ on: true });
    expect(view.result.current).toBe(T0 + 30_000);
    expect(vi.getTimerCount()).toBe(1);
  });
});
