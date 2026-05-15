import { ToolCallState } from "core";
import { describe, expect, it } from "vitest";
import { getStreamingIndicatorText } from "./utils";

function createToolCallState(status: ToolCallState["status"]): ToolCallState {
  return {
    toolCallId: `tool-${status}`,
    status,
    toolCall: {
      id: `tool-${status}`,
      type: "function",
      function: {
        name: "read_file",
        arguments: "{}",
      },
    },
    parsedArgs: {},
    output: [],
  };
}

describe("getStreamingIndicatorText", () => {
  it("returns Generating when there are no tool calls", () => {
    expect(getStreamingIndicatorText([])).toBe("Generating");
  });

  it("summarizes active generating/calling tool actions", () => {
    const toolCalls = [
      createToolCallState("calling"),
      createToolCallState("generating"),
      createToolCallState("done"),
    ];

    expect(getStreamingIndicatorText(toolCalls)).toBe("Performing 2 actions");
  });

  it("surfaces pending action state for generated tool calls", () => {
    const toolCalls = [createToolCallState("generated")];

    expect(getStreamingIndicatorText(toolCalls)).toBe("Pending 1 action");
  });
});
