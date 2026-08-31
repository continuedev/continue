// @vitest-environment jsdom
import { ToolCallState } from "core";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { SubagentToolCall } from "./SubagentToolCall";

// Pulls in the components barrel -> Tooltip -> getFontSize -> localStorage,
// none of which this component's logic depends on.
vi.mock("../../../components/StyledMarkdownPreview", () => ({
  default: ({ source }: { source: string }) => <div>{source}</div>,
}));

function state(overrides: Partial<ToolCallState>): ToolCallState {
  return {
    toolCallId: "call-1",
    status: "calling",
    parsedArgs: {},
    toolCall: {
      id: "call-1",
      type: "function",
      function: { name: "spawn_subagents", arguments: "" },
    },
    ...overrides,
  } as ToolCallState;
}

// incrementalParseJson emits partial shapes while args stream in, so `tasks`
// is briefly a string, then an object, before it ever becomes an array.
// Assuming it was always an array crashed the whole webview.
test.each([
  ["a partially streamed string", '[{"description": "Find au'],
  ["an object", { description: "Find auth" }],
  ["undefined", undefined],
  ["null", null],
  ["a number", 3],
])("SubagentToolCall renders while tasks is still %s", (_label, tasks) => {
  expect(() =>
    render(
      <SubagentToolCall
        toolCallState={state({ parsedArgs: { tasks } })}
        historyIndex={0}
      />,
    ),
  ).not.toThrow();
});

test("SubagentToolCall skips streamed tasks that have no description yet", () => {
  render(
    <SubagentToolCall
      toolCallState={state({
        parsedArgs: { tasks: [{ prompt: "no description yet" }, {}] },
      })}
      historyIndex={0}
    />,
  );

  expect(screen.getByText("Preparing subagents…")).toBeDefined();
});

test("SubagentToolCall lists streamed tasks before any output arrives", () => {
  render(
    <SubagentToolCall
      toolCallState={state({
        parsedArgs: {
          tasks: [
            { description: "Find auth entrypoints", prompt: "x" },
            { description: "Map tool definitions", prompt: "y" },
          ],
        },
      })}
      historyIndex={0}
    />,
  );

  expect(screen.getByText("2 subagents")).toBeDefined();
  expect(screen.getByText("Find auth entrypoints")).toBeDefined();
  expect(screen.getByText("Map tool definitions")).toBeDefined();
});

test("SubagentToolCall prefers live output over streamed args", () => {
  render(
    <SubagentToolCall
      toolCallState={state({
        parsedArgs: { tasks: [{ description: "stale label", prompt: "x" }] },
        output: [
          {
            name: "Find auth entrypoints",
            description: "Done",
            content: "the report",
            status: "done",
          },
        ],
      })}
      historyIndex={0}
    />,
  );

  expect(screen.getByText("Find auth entrypoints")).toBeDefined();
  expect(screen.queryByText("stale label")).toBeNull();
});

test("SubagentToolCall tolerates a non-array output", () => {
  expect(() =>
    render(
      <SubagentToolCall
        toolCallState={state({ output: "not an array" as any })}
        historyIndex={0}
      />,
    ),
  ).not.toThrow();
});
