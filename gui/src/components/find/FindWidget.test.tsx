import { act, fireEvent, render, screen } from "@testing-library/react";
import { useMemo } from "react";
import { vi } from "vitest";
import { useFindWidget } from "./FindWidget";

// Mocks
const mockVirtuosoRef = { current: { scrollToIndex: vi.fn() } } as any;
const mockSearchRef = { current: { clientHeight: 100 } } as any;
const mockHeaderRef = {
  current: { clientHeight: 50 },
  isResizing: false,
} as any;

// Mock Chat History
const generateHistory = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    message: {
      id: `msg-${i}`,
      role: "user",
      content: `Message content ${i} search-term`,
    },
  }));

const TestComponent = ({ historyCount = 1000 }) => {
  const history = useMemo(() => generateHistory(historyCount), [historyCount]);
  const { widget } = useFindWidget(
    mockVirtuosoRef,
    mockSearchRef,
    mockHeaderRef,
    history as any,
    false,
  );
  return widget;
};

describe("FindWidget Search Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should process search in async chunks and display results", async () => {
    render(<TestComponent historyCount={500} />);

    // 1. Open Widget
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "f",
        metaKey: true, // or ctrlKey
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    // 2. Widget should be visible.
    const input = screen.getByPlaceholderText("Search...");
    expect(input).toBeInTheDocument();

    // 3. Type search term
    fireEvent.change(input, { target: { value: "search-term" } });

    // 4. Fast-forward debounce (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // 5. Run async chunks
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 6. Verify results
    expect(screen.getByText("1 of 500")).toBeInTheDocument();
  });

  it("should abort previous search when new term is typed", async () => {
    render(<TestComponent historyCount={5000} />); // Large history

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", metaKey: true }),
      );
    });

    const input = screen.getByPlaceholderText("Search...");

    // Type "search-term"
    fireEvent.change(input, { target: { value: "search-term" } });

    // Advance debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Advance slightly into search (e.g. 20ms) - let 2 chunks run
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    // Change input immediately
    fireEvent.change(input, { target: { value: "Message content 0" } }); // Should be 1 match

    // Advance debounce for new term
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Finish everything
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should see "1 of 1", NOT "1 of 5000"
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
  });
});
