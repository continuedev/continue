import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tool, ToolCallState } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
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

  it("should let keyboard users open generic tool results from the header", async () => {
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

    const header = screen.getByRole("button", { name: "Open Custom Tool" });
    header.focus();

    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(openContextItem).toHaveBeenCalledTimes(2);
    expect(openContextItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "Only result" }),
      expect.anything(),
    );
  });

  it("should leave generic tool headers non-interactive when there is no output", () => {
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

    expect(screen.getByTestId("tool-call-display-header")).not.toHaveAttribute(
      "role",
    );
    expect(screen.getByTestId("tool-call-display-header")).not.toHaveAttribute(
      "tabindex",
    );
  });
});
