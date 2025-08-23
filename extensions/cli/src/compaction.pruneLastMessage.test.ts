import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { describe, it, expect } from "vitest";

import { pruneLastMessage } from "./compaction.js";

describe("pruneLastMessage", () => {
  it("should return empty array for empty input", () => {
    const result = pruneLastMessage([]);
    expect(result).toEqual([]);
  });

  it("should remove single user message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should return empty array for single system message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should return empty array for single assistant message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "assistant", content: "Hello" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should return empty array for single tool message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "tool", content: "Tool output", tool_call_id: "1" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should remove last message when second-to-last is user", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([{ role: "system", content: "System" }]);
  });

  it("should remove assistant+tool sequence when second-to-last is assistant with tool calls", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Run command" },
      {
        role: "assistant",
        content: "Running...",
        tool_calls: [{ id: "1" } as any],
      },
      { role: "tool", content: "Command output", tool_call_id: "1" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Run command" },
    ]);
  });

  it("should prune last message when second-to-last is not user or assistant with tool calls", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Another question" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("should handle multiple user messages by removing two at a time", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Question 1" },
      { role: "user", content: "Question 2" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([{ role: "system", content: "System" }]);
  });

  it("should handle tool call sequences by removing user after tool", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Do something" },
      {
        role: "assistant",
        content: "I'll help",
        tool_calls: [{ id: "1" } as any],
      },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
      { role: "user", content: "Follow up question" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Do something" },
      {
        role: "assistant",
        content: "I'll help",
        tool_calls: [{ id: "1" } as any],
      },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
    ]);
  });

  it("should remove both user messages when consecutive", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: "Another message" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should handle complex conversation flow", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Request 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Request 2" },
      {
        role: "assistant",
        content: "Using tool",
        tool_calls: [{ id: "1" } as any],
      },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
      { role: "assistant", content: "Final response" },
      { role: "user", content: "Follow up 1" },
      { role: "user", content: "Follow up 2" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Request 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Request 2" },
      {
        role: "assistant",
        content: "Using tool",
        tool_calls: [{ id: "1" } as any],
      },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
      { role: "assistant", content: "Final response" },
    ]);
  });

  it("should handle history starting with non-system message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Follow up" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
  });
});
