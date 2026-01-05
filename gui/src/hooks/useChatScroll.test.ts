import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatScroll } from "./useChatScroll";

describe("useChatScroll", () => {
  it("should scroll to bottom on initial load if history exists", () => {
    const scrollToMock = vi.fn();
    const virtuosoRef = {
      current: {
        scrollToIndex: scrollToMock,
      },
    } as any;

    vi.useFakeTimers();

    renderHook(() => useChatScroll(10, false, virtuosoRef));

    vi.advanceTimersByTime(100);

    expect(scrollToMock).toHaveBeenCalledWith({
      index: 9,
      align: "end",
    });

    vi.useRealTimers();
  });

  it("should not scroll on initial load if history is empty", () => {
    const scrollToMock = vi.fn();
    const virtuosoRef = {
      current: {
        scrollToIndex: scrollToMock,
      },
    } as any;

    vi.useFakeTimers();
    renderHook(() => useChatScroll(0, false, virtuosoRef));
    vi.advanceTimersByTime(100);

    expect(scrollToMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("should return 'auto' for followOutput when streaming and at bottom", () => {
    const virtuosoRef = { current: null } as any;
    const { result } = renderHook(() => useChatScroll(10, true, virtuosoRef));

    // Default shouldAutoScroll is true
    const output = result.current.handleFollowOutput(true);
    expect(output).toBe("auto");
  });

  it("should return false for followOutput when not streaming", () => {
    const virtuosoRef = { current: null } as any;
    const { result } = renderHook(() => useChatScroll(10, false, virtuosoRef));

    const output = result.current.handleFollowOutput(true);
    expect(output).toBe(false);
  });

  it("should update shouldAutoScroll ref on atBottomStateChange", () => {
    const virtuosoRef = { current: null } as any;
    const { result } = renderHook(() => useChatScroll(10, true, virtuosoRef));

    // Initially true, so followOutput(true) -> "auto"
    expect(result.current.handleFollowOutput(true)).toBe("auto");

    // Scroll up (not at bottom)
    result.current.handleAtBottomStateChange(false);

    // Even if isAtBottom passed to followOutput is true (e.g. temporary check),
    // the internal ref should prevent auto-scroll if we manually scrolled up?
    // Wait, handleAtBottomStateChange updates the ref.
    // handleFollowOutput checks the ref.

    // If we call handleFollowOutput(true) now:
    // ref is false. So it returns false.
    expect(result.current.handleFollowOutput(true)).toBe(false);

    // Scroll back down
    result.current.handleAtBottomStateChange(true);
    expect(result.current.handleFollowOutput(true)).toBe("auto");
  });
});
