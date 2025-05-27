import { configureStore } from "@reduxjs/toolkit";
import { screen } from "@testing-library/dom";
import { act, render } from "@testing-library/react";
import { ContextItemWithId, ToolCall, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { grepSearchTool } from "core/tools/definitions/grepSearch";
import { Provider } from "react-redux";
import { configSlice } from "../../../redux/slices/configSlice";
import { ToolCallDiv } from "./index";

const testToolArgs = { query: "test query" };

const testToolCall: ToolCall = {
  id: "1",
  type: "function",
  function: {
    name: BuiltInToolNames.GrepSearch,
    arguments: JSON.stringify(testToolArgs),
  },
};

const testToolCallOutput: ToolCallState["output"] = [
  {
    name: "Test Tool Output Name",
    description: "Tool output",
    content: "test tool output content",
    hidden: false,
  },
];

const testToolCallOutputWithId: ContextItemWithId[] = testToolCallOutput.map(
  (tool) => ({ ...tool, id: { itemId: "testid", providerTitle: "test" } }),
);

const getToolCallState = (
  status: ToolCallState["status"],
) => {
  return {
    toolCallId: "1",
    toolCall: structuredClone(testToolCall),
    status: status,
    parsedArgs: structuredClone(testToolArgs),
  } as ToolCallState;
};

const createMockStore = () => {
  return configureStore({
    preloadedState: {
      config: {
        config: {
          tools: [grepSearchTool],
        },
      },
    },
    reducer: {
      config: configSlice.reducer as any,
    },
  });
};

describe("Tool Call test", () => {
  it("should have the tool call status", async () => {
    render(
      <Provider store={createMockStore()}>
        <ToolCallDiv
          historyIndex={1}
          toolCall={testToolCall}
          toolCallState={getToolCallState("generated")}
        />
      </Provider>,
    );
    expect(screen.getByTestId("tool-call-status")).toBeInTheDocument();
  });

  it("should the toggle icon if there are args", () => {
    render(
      <Provider store={createMockStore()}>
        <ToolCallDiv
          historyIndex={1}
          toolCall={testToolCall}
          toolCallState={getToolCallState("done")}
        />
      </Provider>,
    );
    expect(screen.getByTestId("tools-args-toggle")).toBeInTheDocument();
  });

  it("should be able to toggle the arguments", () => {
    render(
      <Provider store={createMockStore()}>
        <ToolCallDiv
          historyIndex={1}
          toolCall={testToolCall}
          toolCallState={getToolCallState("done")}
        />
      </Provider>,
    );
    const toggleButton = screen.getByTestId("tools-args-toggle");
    act(() => toggleButton.click());
    expect(screen.getByTestId("tools-args-and-output")).toBeInTheDocument();
    act(() => toggleButton.click());
    expect(
      screen.queryByTestId("tools-args-and-output"),
    ).not.toBeInTheDocument();
  });

  it("should contain the tool arguments and output", () => {
    render(
      <Provider store={createMockStore()}>
        <ToolCallDiv
          output={testToolCallOutputWithId}
          historyIndex={1}
          toolCall={testToolCall}
          toolCallState={getToolCallState("done")}
        />
      </Provider>,
    );
    const toggleButton = screen.getByTestId("tools-args-toggle");
    act(() => toggleButton.click());
    expect(screen.getByTestId("tools-args-and-output")).toBeInTheDocument();
    expect(screen.getByText(testToolArgs.query)).toBeInTheDocument();
    expect(screen.getByText(testToolCallOutput[0].name)).toBeInTheDocument();
  });

  it("should show the context output items even if args are absent", () => {
    const modifiedTestToolCall = { ...testToolCall };
    modifiedTestToolCall.function.arguments = undefined as any;
    const modifiedTestToolCallState = getToolCallState("done");
    modifiedTestToolCallState.parsedArgs = {};
    render(
      <Provider store={createMockStore()}>
        <ToolCallDiv
          output={testToolCallOutputWithId}
          historyIndex={1}
          toolCall={modifiedTestToolCall}
          toolCallState={modifiedTestToolCallState}
        />
      </Provider>,
    );
    const toggleButton = screen.getByTestId("tools-args-toggle");
    act(() => toggleButton.click());
    expect(screen.getByTestId("tools-args-and-output")).toBeInTheDocument();
    expect(screen.queryByText(testToolArgs.query)).not.toBeInTheDocument();
    expect(screen.getByText(testToolCallOutput[0].name)).toBeInTheDocument();
  });
});
