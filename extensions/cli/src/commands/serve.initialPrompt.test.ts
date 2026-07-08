import type { ChatHistoryItem } from "core/index.js";
import { describe, expect, it } from "vitest";

import { shouldQueueInitialPrompt } from "./serve.js";

const systemOnly: ChatHistoryItem[] = [
  { message: { role: "system", content: "sys" }, contextItems: [] },
];

const withConversation: ChatHistoryItem[] = [
  ...systemOnly,
  { message: { role: "user", content: "hi" }, contextItems: [] },
  { message: { role: "assistant", content: "hello" }, contextItems: [] },
];

describe("shouldQueueInitialPrompt", () => {
  it("returns false when no prompt is provided", () => {
    expect(shouldQueueInitialPrompt([], undefined)).toBe(false);
    expect(shouldQueueInitialPrompt([], null)).toBe(false);
  });

  it("returns true when prompt exists and only system history is present", () => {
    expect(shouldQueueInitialPrompt([], "prompt")).toBe(true);
    expect(shouldQueueInitialPrompt(systemOnly, "prompt")).toBe(true);
  });

  it("returns false when prompt exists but conversation already has non-system messages", () => {
    expect(shouldQueueInitialPrompt(withConversation, "prompt")).toBe(false);
  });
});
