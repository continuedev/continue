import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tool, ToolCallState } from "core";
import { describe, expect, it, vi } from "vitest";
import { SimpleToolCallUI } from "./SimpleToolCallUI";

vi.mock(
  "../../../components/mainInput/belowMainInput/ContextItemsPeek",
  () => ({
    openContextItem: vi.fn(),
    ContextItemsPeekItem: ({ contextItem }: any) => (
      <div data-testid="context-item">{contextItem.name}</div>
    ),
  }),
);

vi.mock("./ToolTruncateHistoryIcon", () => ({
  ToolTruncateHistoryIcon: () => <div data-testid="tool-truncate-history" />,
}));

function createToolCallState(): ToolCallState {
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
    output: [
      {
        id: {
          providerTitle: "toolCall",
          itemId: "ctx-1",
        },
        name: "First result",
        description: "first.txt",
        content: "one",
        uri: {
          type: "file",
          value: "file:///workspace/first.txt",
        },
      },
      {
        id: {
          providerTitle: "toolCall",
          itemId: "ctx-2",
        },
        name: "Second result",
        description: "second.txt",
        content: "two",
        uri: {
          type: "file",
          value: "file:///workspace/second.txt",
        },
      },
    ],
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

describe("SimpleToolCallUI", () => {
  it("should let keyboard users toggle multi-item tool results", async () => {
    const user = userEvent.setup();

    render(
      <SimpleToolCallUI
        toolCallState={createToolCallState()}
        tool={mockTool}
        historyIndex={0}
      />,
    );

    const header = screen.getByTestId("context-items-peek");
    header.focus();

    expect(header).toHaveAttribute("aria-label", "Toggle Custom Tool results");
    expect(header).toHaveAttribute(
      "aria-controls",
      "simple-tool-call-body-tool-call-1",
    );
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("simple-tool-call-body").className).toContain(
      "max-h-[50vh]",
    );

    await user.keyboard(" ");

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("simple-tool-call-body").className).toContain(
      "max-h-0",
    );
  });

  it("should only toggle once when clicking the simple tool-call icon", async () => {
    const user = userEvent.setup();

    render(
      <SimpleToolCallUI
        toolCallState={createToolCallState()}
        tool={mockTool}
        historyIndex={0}
      />,
    );

    const header = screen.getByTestId("context-items-peek");
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByTestId("simple-tool-call-toggle"));

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("simple-tool-call-body").className).toContain(
      "max-h-[50vh]",
    );
  });
});
