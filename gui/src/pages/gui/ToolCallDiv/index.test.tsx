import { screen } from "@testing-library/react";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { describe, expect, it, vi } from "vitest";
import {
  createMockStore,
  getEmptyRootState,
} from "../../../util/test/mockStore";
import { renderWithProviders } from "../../../util/test/render";
import { ToolCallDiv } from "./index";

vi.mock("./FunctionSpecificToolCallDiv", () => ({
  default: ({ toolCallState }: any) => (
    <div
      data-testid={`function-specific-tool-call-${toolCallState.toolCallId}`}
    />
  ),
}));

vi.mock("./ToolCallDisplay", () => ({
  ToolCallDisplay: ({ children, toolCallState }: any) => (
    <div data-testid={`tool-call-display-${toolCallState.toolCallId}`}>
      {children}
    </div>
  ),
}));

vi.mock("./SimpleToolCallUI", () => ({
  SimpleToolCallUI: ({ toolCallState }: any) => (
    <div data-testid={`simple-tool-call-${toolCallState.toolCallId}`} />
  ),
}));

vi.mock("./MCPAppRenderer", () => ({
  McpAppRenderer: () => <div data-testid="mcp-app-renderer" />,
}));

function createToolCallState(
  toolCallId: string,
  status: ToolCallState["status"],
  functionName = "customTool",
): ToolCallState {
  return {
    toolCallId,
    status,
    toolCall: {
      id: toolCallId,
      type: "function",
      function: {
        name: functionName,
        arguments: "{}",
      },
    },
    parsedArgs: {},
    output: [],
  };
}

describe("ToolCallDiv", () => {
  it("should keep grouped multi-call activity visible while tool calls are still generating", async () => {
    const toolCallStates = [
      createToolCallState("tool-call-1", "generating"),
      createToolCallState("tool-call-2", "generating"),
    ];

    await renderWithProviders(
      <ToolCallDiv toolCallStates={toolCallStates} historyIndex={0} />,
      {
        store: createMockStore(getEmptyRootState()),
      },
    );

    expect(screen.getByTestId("performing-actions")).toHaveTextContent(
      "Generating 2 actions",
    );
    expect(
      screen.getByTestId("grouped-tool-call-container").className,
    ).toContain("px-2.5");
    expect(screen.getByTestId("grouped-tool-call-row-0").className).toContain(
      "pl-4",
    );
    expect(
      screen.getByTestId("tool-call-display-tool-call-1"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("tool-call-display-tool-call-2"),
    ).toBeInTheDocument();
  });

  it("should summarize mixed grouped tool-call statuses in the header", async () => {
    const toolCallStates = [
      createToolCallState("tool-call-1", "calling"),
      createToolCallState("tool-call-2", "done"),
      createToolCallState("tool-call-3", "errored"),
    ];

    await renderWithProviders(
      <ToolCallDiv toolCallStates={toolCallStates} historyIndex={0} />,
      {
        store: createMockStore(getEmptyRootState()),
      },
    );

    expect(
      screen.getByTestId("grouped-tool-call-status-summary"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("grouped-tool-call-status-active"),
    ).toHaveTextContent("1 active");
    expect(
      screen.getByTestId("grouped-tool-call-status-done"),
    ).toHaveTextContent("1 done");
    expect(
      screen.getByTestId("grouped-tool-call-status-errored"),
    ).toHaveTextContent("1 errored");
  });

  it("should let keyboard users toggle the grouped tool-call header", async () => {
    const toolCallStates = [
      createToolCallState("tool-call-1", "calling"),
      createToolCallState("tool-call-2", "done"),
    ];

    const { user } = await renderWithProviders(
      <ToolCallDiv toolCallStates={toolCallStates} historyIndex={0} />,
      {
        store: createMockStore(getEmptyRootState()),
      },
    );

    const groupedHeader = screen.getByTestId("performing-actions");
    groupedHeader.focus();

    expect(groupedHeader).toHaveAttribute(
      "aria-label",
      "Toggle grouped tool activity",
    );
    expect(groupedHeader).toHaveAttribute(
      "aria-controls",
      "grouped-tool-call-body",
    );
    expect(groupedHeader).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");

    expect(groupedHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("grouped-tool-call-body").className).toContain(
      "max-h-0",
    );

    await user.keyboard(" ");

    expect(groupedHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("grouped-tool-call-body").className).toContain(
      "max-h-[50vh]",
    );
  });

  it("should only toggle once when clicking the grouped tool-call icon", async () => {
    const toolCallStates = [
      createToolCallState("tool-call-1", "calling"),
      createToolCallState("tool-call-2", "done"),
    ];

    const { user } = await renderWithProviders(
      <ToolCallDiv toolCallStates={toolCallStates} historyIndex={0} />,
      {
        store: createMockStore(getEmptyRootState()),
      },
    );

    expect(screen.getByTestId("performing-actions")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByTestId("grouped-tool-call-toggle"));

    expect(screen.getByTestId("performing-actions")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByTestId("grouped-tool-call-body").className).toContain(
      "max-h-0",
    );
  });

  it("should prefer the function-specific renderer for subagent tool calls even when an icon is configured", async () => {
    const initialState = getEmptyRootState();
    initialState.config.config.tools = [
      {
        function: {
          name: BuiltInToolNames.Subagent,
          description: "Run subagent",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        toolCallIcon: "Squares2X2Icon",
      } as any,
    ];

    await renderWithProviders(
      <ToolCallDiv
        toolCallStates={[
          createToolCallState(
            "tool-call-subagent",
            "calling",
            BuiltInToolNames.Subagent,
          ),
        ]}
        historyIndex={0}
      />,
      {
        store: createMockStore(initialState),
      },
    );

    expect(
      screen.getByTestId("function-specific-tool-call-tool-call-subagent"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("simple-tool-call-tool-call-subagent"),
    ).not.toBeInTheDocument();
  });
});
