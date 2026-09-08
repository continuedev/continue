import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_IDENTICAL_TOOL_CALLS,
  getToolCallFingerprint,
  ToolCallLoopGuard,
} from "./toolCallLoopGuard.js";

const toolCall = (id: string, args: Record<string, unknown>) => ({
  id,
  name: "read_file",
  arguments: args,
  argumentsStr: JSON.stringify(args),
  startNotified: true,
});

describe("ToolCallLoopGuard", () => {
  it("ignores provider-generated IDs and object key order", () => {
    expect(
      getToolCallFingerprint([toolCall("first", { path: "a", line: 1 })]),
    ).toBe(
      getToolCallFingerprint([toolCall("second", { line: 1, path: "a" })]),
    );
  });

  it("blocks only after the configured consecutive limit", () => {
    const guard = new ToolCallLoopGuard();
    const calls = [toolCall("call-1", { path: "a" })];

    expect(guard.observe(calls)).toMatchObject({
      count: 1,
      blocked: false,
    });
    expect(guard.observe([toolCall("call-2", { path: "a" })])).toMatchObject({
      count: DEFAULT_MAX_IDENTICAL_TOOL_CALLS,
      blocked: false,
    });
    expect(guard.observe([toolCall("call-3", { path: "a" })])).toMatchObject({
      count: DEFAULT_MAX_IDENTICAL_TOOL_CALLS + 1,
      blocked: true,
    });
  });

  it("resets when the agent changes the tool call or returns no tools", () => {
    const guard = new ToolCallLoopGuard(2);

    guard.observe([toolCall("call-1", { path: "a" })]);
    guard.observe([toolCall("call-2", { path: "a" })]);
    expect(guard.observe([toolCall("call-3", { path: "b" })])).toMatchObject({
      count: 1,
      blocked: false,
    });
    expect(guard.observe([])).toMatchObject({
      count: 0,
      blocked: false,
    });
    expect(guard.observe([toolCall("call-4", { path: "a" })])).toMatchObject({
      count: 1,
      blocked: false,
    });
  });
});
