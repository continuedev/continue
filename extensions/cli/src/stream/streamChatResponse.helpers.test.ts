import { describe, expect, it } from "vitest";

import type { ToolCall } from "../tools/types.js";

import { processToolCallDelta } from "./streamChatResponse.helpers.js";

function freshMaps() {
  return {
    toolCallsMap: new Map<string, ToolCall>(),
    indexToIdMap: new Map<number, string>(),
  };
}

describe("processToolCallDelta", () => {
  it("creates an entry for an id-less delta carrying only an index (Ollama)", () => {
    const { toolCallsMap, indexToIdMap } = freshMaps();

    processToolCallDelta(
      { index: 0, function: { name: "read_file", arguments: '{"filepath":' } },
      toolCallsMap,
      indexToIdMap,
    );

    const entry = toolCallsMap.get("call_0");
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("read_file");
    expect(indexToIdMap.get(0)).toBe("call_0");
  });

  it("accumulates later id-less fragments for the same index", () => {
    const { toolCallsMap, indexToIdMap } = freshMaps();

    processToolCallDelta(
      { index: 1, function: { name: "read_file", arguments: '{"filepath":' } },
      toolCallsMap,
      indexToIdMap,
    );
    processToolCallDelta(
      { index: 1, function: { arguments: '"convex/schema.ts"}' } },
      toolCallsMap,
      indexToIdMap,
    );

    expect(toolCallsMap.size).toBe(1);
    expect(toolCallsMap.get("call_1")?.arguments).toEqual({
      filepath: "convex/schema.ts",
    });
  });

  it("keeps provider-supplied IDs untouched", () => {
    const { toolCallsMap, indexToIdMap } = freshMaps();

    processToolCallDelta(
      {
        id: "call_abc123",
        index: 0,
        function: { name: "read_file", arguments: '{"filepath":"x"}' },
      },
      toolCallsMap,
      indexToIdMap,
    );

    expect(toolCallsMap.get("call_abc123")?.name).toBe("read_file");
    expect(toolCallsMap.has("call_0")).toBe(false);
    expect(indexToIdMap.get(0)).toBe("call_abc123");
  });

  it("still drops deltas with neither id nor index", () => {
    const { toolCallsMap, indexToIdMap } = freshMaps();

    processToolCallDelta(
      { function: { name: "x" } },
      toolCallsMap,
      indexToIdMap,
    );

    expect(toolCallsMap.size).toBe(0);
  });
});
