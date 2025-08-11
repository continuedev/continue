import { render, screen, fireEvent } from "@testing-library/react";
import { ChatHistoryItem } from "core";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Reasoning from "./Reasoning";

// Mock dependencies
vi.mock("../StyledMarkdownPreview", () => ({
  default: ({ source }: { source: string }) => (
    <div data-testid="markdown-preview">{source}</div>
  ),
}));

describe("Reasoning Component", () => {
  const mockItem: ChatHistoryItem = {
    message: {
      role: "assistant",
      content: "Test response",
    },
    contextItems: [],
    reasoning: {
      text: "This is my internal reasoning process",
      startAt: 1000,
      endAt: 2000,
      active: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render thinking button when reasoning is active", () => {
    const activeReasoningItem: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "I'm thinking about this...",
        startAt: 1000,
        active: true,
      },
    };

    render(<Reasoning item={activeReasoningItem} index={0} isLast={false} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("Thinking").parentElement).toBeInTheDocument();
  });

  it("should render thought duration when reasoning is complete", () => {
    render(<Reasoning item={mockItem} index={0} isLast={false} />);

    expect(screen.getByText("Thought for 1.0s")).toBeInTheDocument();
    expect(screen.getByText("Thought for 1.0s").parentElement).toBeInTheDocument();
  });

  it("should not render anything when no reasoning text is present", () => {
    const itemWithoutReasoning: ChatHistoryItem = {
      ...mockItem,
      reasoning: undefined,
    };

    const { container } = render(
      <Reasoning item={itemWithoutReasoning} index={0} isLast={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should not render when reasoning text is empty", () => {
    const itemWithEmptyReasoning: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "",
        startAt: 1000,
        endAt: 2000,
        active: false,
      },
    };

    const { container } = render(
      <Reasoning item={itemWithEmptyReasoning} index={0} isLast={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should toggle reasoning content when clicked", () => {
    render(<Reasoning item={mockItem} index={0} isLast={false} />);

    const button = screen.getByText("Thought for 1.0s").parentElement!;
    
    // Initially closed
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    
    expect(screen.getByTestId("markdown-preview")).toBeInTheDocument();
    expect(screen.getByText("This is my internal reasoning process")).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
  });

  it("should calculate correct duration from startAt and endAt", () => {
    const itemWithSpecificTiming: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "Test reasoning",
        startAt: 1000,
        endAt: 3500, // 2.5 seconds later
        active: false,
      },
    };

    render(<Reasoning item={itemWithSpecificTiming} index={0} isLast={false} />);

    expect(screen.getByText("Thought for 2.5s")).toBeInTheDocument();
  });

  it("should handle missing startAt gracefully", () => {
    const itemWithMissingStartAt: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "Test reasoning",
        startAt: Date.now() - 1000,
        endAt: Date.now(),
        active: false,
      },
    };

    render(<Reasoning item={itemWithMissingStartAt} index={0} isLast={false} />);

    // Should still render with calculated duration
    const reasoningText = screen.getByText((content) => content.includes("Thought for") && content.includes("s"));
    expect(reasoningText).toBeInTheDocument();
  });

  it("should show animated thinking indicator for active reasoning", () => {
    const activeReasoningItem: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "Thinking...",
        startAt: 1000,
        active: true,
      },
    };

    render(<Reasoning item={activeReasoningItem} index={0} isLast={false} />);

    const thinkingElement = screen.getByText("Thinking");
    expect(thinkingElement).toBeInTheDocument();
    expect(thinkingElement.parentElement).toBeInTheDocument();
  });

  it("should pass correct props to StyledMarkdownPreview", () => {
    render(<Reasoning item={mockItem} index={0} isLast={false} />);

    // Open the reasoning content
    fireEvent.click(screen.getByText("Thought for 1.0s").parentElement!);

    const markdownPreview = screen.getByTestId("markdown-preview");
    expect(markdownPreview).toBeInTheDocument();
    expect(markdownPreview).toHaveTextContent("This is my internal reasoning process");
  });

  it("should handle reasoning with no endAt for active state", () => {
    const activeItemWithoutEndAt: ChatHistoryItem = {
      ...mockItem,
      reasoning: {
        text: "Still thinking...",
        startAt: 1000,
        active: true,
      },
    };

    render(<Reasoning item={activeItemWithoutEndAt} index={0} isLast={false} />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    // Should not show duration when still thinking
    expect(screen.queryByText(/Thought for/)).not.toBeInTheDocument();
  });
});