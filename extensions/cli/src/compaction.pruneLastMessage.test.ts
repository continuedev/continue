import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { describe, it, expect } from "vitest";

import { pruneLastMessage } from "./compaction.js";

describe("pruneLastMessage", () => {
  it("should return empty array for empty input", () => {
    const result = pruneLastMessage([]);
    expect(result).toEqual([]);
  });

  it("should preserve history ending with assistant message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual(history);
  });

  it("should preserve history ending with tool message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Run command" },
      { role: "assistant", content: "Running...", tool_calls: [{ id: "1" } as any] },
      { role: "tool", content: "Command output", tool_call_id: "1" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual(history);
  });

  it("should prune user messages at the end", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Another question" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("should prune multiple user messages at the end", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "Question 1" },
      { role: "user", content: "Question 2" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("should handle tool call sequences correctly", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Do something" },
      { role: "assistant", content: "I'll help", tool_calls: [{ id: "1" } as any] },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
      { role: "user", content: "Follow up question" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Do something" },
      { role: "assistant", content: "I'll help", tool_calls: [{ id: "1" } as any] },
      { role: "tool", content: "Tool result", tool_call_id: "1" },
    ]);
  });

  it("should return only system message when no assistant/tool messages exist", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "user", content: "Another message" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
    ]);
  });

  it("should return empty array when no system message and no assistant/tool messages", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: "Another message" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([]);
  });

  it("should handle history with only system message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "system", content: "System" },
    ]);
  });

  it("should handle history with only assistant message", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "assistant", content: "Hello" },
    ];

    const result = pruneLastMessage(history);
    expect(result).toEqual([
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("should handle complex conversation flow", () => {
    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Request 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Request 2" },
      { role: "assistant", content: "Using tool", tool_calls: [{ id: "1" } as any] },
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
      { role: "assistant", content: "Using tool", tool_calls: [{ id: "1" } as any] },
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