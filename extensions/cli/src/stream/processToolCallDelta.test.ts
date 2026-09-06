import { describe, expect, it } from "vitest";

import { processToolCallDelta } from "./streamChatResponse.helpers.js";
import { ToolCall } from "../tools/types.js";

describe("processToolCallDelta", () => {
  it("synthesizes a stable id when the first delta has index but no id", () => {
    const toolCallsMap = new Map<string, ToolCall>();
    const indexToIdMap = new Map<number, string>();

    processToolCallDelta(
      {
        index: 0,
        function: { name: "Read", arguments: '{"filepath":' },
      },
      toolCallsMap,
      indexToIdMap,
    );

    expect(indexToIdMap.get(0)).toBe("call_0");
    expect(toolCallsMap.has("call_0")).toBe(true);
    expect(toolCallsMap.get("call_0")?.name).toBe("Read");
    expect(toolCallsMap.get("call_0")?.argumentsStr).toBe('{"filepath":');

    processToolCallDelta(
      {
        index: 0,
        function: { arguments: '"convex/schema.ts"}' },
      },
      toolCallsMap,
      indexToIdMap,
    );

    expect(toolCallsMap.size).toBe(1);
    expect(toolCallsMap.get("call_0")?.arguments).toEqual({
      filepath: "convex/schema.ts",
    });
  });

  it("still prefers a real id when provided", () => {
    const toolCallsMap = new Map<string, ToolCall>();
    const indexToIdMap = new Map<number, string>();

    processToolCallDelta(
      {
        index: 1,
        id: "toolu_real",
        function: { name: "Write", arguments: "{}" },
      },
      toolCallsMap,
      indexToIdMap,
    );

    expect(indexToIdMap.get(1)).toBe("toolu_real");
    expect(toolCallsMap.has("toolu_real")).toBe(true);
    expect(toolCallsMap.has("call_1")).toBe(false);
  });
});
