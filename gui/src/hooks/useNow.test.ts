import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./useNow";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("moves forward about every 15 seconds", () => {
    const { result } = renderHook(() => useNow());
    const start = result.current;
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current - start).toBe(15_000);
  });

  it("uses a single timer however many components ask", () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    const c = renderHook(() => useNow());
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(b.result.current).toBe(a.result.current);
    expect(c.result.current).toBe(a.result.current);
    a.unmount();
    b.unmount();
    c.unmount();
    spy.mockRestore();
  });

  it("stops the timer when the last component goes away", () => {
    const clear = vi.spyOn(globalThis, "clearInterval");
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    a.unmount();
    expect(clear).not.toHaveBeenCalled();
    b.unmount();
    expect(clear).toHaveBeenCalledTimes(1);
    clear.mockRestore();
  });

  it("starts again for a component that arrives later", () => {
    const first = renderHook(() => useNow());
    first.unmount();
    const second = renderHook(() => useNow());
    const start = second.result.current;
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(second.result.current - start).toBe(15_000);
    second.unmount();
  });
});
