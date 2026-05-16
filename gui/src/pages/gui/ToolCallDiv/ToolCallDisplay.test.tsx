import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tool, ToolCallState } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolCallDisplay } from "./ToolCallDisplay";

vi.mock(
  "../../../components/mainInput/belowMainInput/ContextItemsPeek",
  () => ({
    openContextItem: vi.fn(),
  }),
);

vi.mock("./ToolTruncateHistoryIcon", () => ({
  ToolTruncateHistoryIcon: () => <div data-testid="tool-truncate-history" />,
}));

function createToolCallState(withOutput: boolean = true): ToolCallState {
  return {
    toolCallId: "tool-call-1",
    status: "done",
    toolCall: {
      id: "tool-call-1",
      type: "function",
      function: {
        name: "customTool",
        arguments: "{}",
      },
    },
    parsedArgs: {},
    output: withOutput
      ? [
          {
            id: {
              providerTitle: "toolCall",
              itemId: "ctx-1",
            },
            name: "Only result",
            description: "result.txt",
            content: "one",
            uri: {
              type: "file",
              value: "file:///workspace/result.txt",
            },
          },
        ]
      : [],
  };
}

const mockTool: Tool = {
  type: "function",
  displayTitle: "Custom Tool",
  wouldLikeTo: "use custom tool",
  function: {
    name: "customTool",
    description: "Custom tool description",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

describe("ToolCallDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should let keyboard users toggle the collapsible body", async () => {
    const user = userEvent.setup();

    render(
      <ToolCallDisplay
        tool={mockTool}
        toolCallState={createToolCallState()}
        historyIndex={0}
        icon={<div data-testid="tool-status-icon" />}
      >
        <div data-testid="tool-call-body">Body</div>
      </ToolCallDisplay>,
    );

    // The header is a button — starts collapsed (status=done, so auto-collapsed)
    const header = screen.getByTestId("tool-call-display-header");
    expect(header.tagName).toBe("BUTTON");
    expect(header).toHaveAttribute("aria-expanded", "false");

    header.focus();
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.keyboard(" ");
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("should always show the toggle button regardless of output", () => {
    render(
      <ToolCallDisplay
        tool={mockTool}
        toolCallState={createToolCallState(false)}
        historyIndex={0}
        icon={<div data-testid="tool-status-icon" />}
      >
        <div data-testid="tool-call-body">Body</div>
      </ToolCallDisplay>,
    );

    const header = screen.getByTestId("tool-call-display-header");
    expect(header.tagName).toBe("BUTTON");
    expect(header).toHaveAttribute("aria-expanded");
  });

  it("shows a down chevron only when expanded", async () => {
    const user = userEvent.setup();

    render(
      <ToolCallDisplay
        tool={mockTool}
        toolCallState={createToolCallState()}
        historyIndex={0}
        icon={<div data-testid="tool-status-icon" />}
      >
        <div data-testid="tool-call-body">Body</div>
      </ToolCallDisplay>,
    );

    expect(
      screen.queryByTestId("tool-call-display-chevron-down"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("tool-call-display-header"));

    expect(
      screen.getByTestId("tool-call-display-chevron-down"),
    ).toBeInTheDocument();
  });
});
