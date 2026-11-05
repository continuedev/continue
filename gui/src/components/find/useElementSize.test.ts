import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementSize } from "./useElementSize";

describe("useElementSize", () => {
  let observers: (() => void)[];

  beforeEach(() => {
    vi.useFakeTimers();
    observers = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // A stable ref, as useRef gives a component: the effect depends on it.
  const ref = () => {
    const r = { current: document.createElement("div") };
    return () => r;
  };

  it("cancels the pending update on unmount", () => {
    const getRef = ref();
    const { unmount } = renderHook(() => useElementSize(getRef(), 250));
    expect(vi.getTimerCount()).toBe(1); // the initial measurement
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps one pending update across rapid resizes", () => {
    const getRef = ref();
    const { result } = renderHook(() => useElementSize(getRef(), 250));
    observers[0]();
    observers[0]();
    observers[0]();
    expect(vi.getTimerCount()).toBe(1);
    expect(result.current.isResizing).toBe(true);
  });
});
