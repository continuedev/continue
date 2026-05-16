import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../StyledMarkdownPreview", () => ({
  default: ({ source }: { source?: string }) => (
    <div data-testid="thinking-markdown-preview">{source ?? ""}</div>
  ),
}));

import ThinkingBlockPeek from "./ThinkingBlockPeek";

describe("ThinkingBlockPeek behavior", () => {
  it("starts expanded and auto-collapses after 5 seconds", () => {
    vi.useFakeTimers();

    render(
      <ThinkingBlockPeek
        content={`Reviewing requirements
Preparing response`}
        index={0}
        prevItem={null}
        inProgress={false}
      />,
    );

    const header = screen.getByRole("button", {
      name: /thinking/i,
    });
    expect(header).toHaveAttribute("aria-expanded", "true");

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(header).toHaveAttribute("aria-expanded", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(header).toHaveAttribute("aria-expanded", "false");

    vi.useRealTimers();
  });

  it("uses down chevron when expanded and right chevron when collapsed", () => {
    vi.useFakeTimers();

    render(
      <ThinkingBlockPeek
        content={`- Read code
- Summarize final findings`}
        index={1}
        prevItem={null}
        inProgress={false}
      />,
    );

    expect(
      screen.getByTestId("thinking-block-chevron-down"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByTestId("thinking-block-chevron-right"),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows a thinking summary in the collapsed title", () => {
    vi.useFakeTimers();

    render(
      <ThinkingBlockPeek
        content={`- Inspect tool output
- Summarize final findings`}
        index={2}
        prevItem={null}
        inProgress={false}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByText(/Thinking · Summarize final findings/i),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });
});
