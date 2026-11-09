import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import { afterEach, describe, expect, it } from "vitest";

import {
  ENVIRONMENT_BLOCK_OPEN,
  environmentContextBlock,
  resetEnvironmentContextBlock,
  withEnvironmentBlock,
} from "./environmentContext.js";

afterEach(() => resetEnvironmentContextBlock());

describe("environmentContextBlock", () => {
  it("carries the date and the git status, and is built once per process", () => {
    const block = environmentContextBlock();
    expect(block.startsWith(ENVIRONMENT_BLOCK_OPEN)).toBe(true);
    expect(block).toContain(
      `Today's date: ${new Date().toISOString().split("T")[0]}`,
    );
    expect(block).toContain("Git status at the start of the session");
    expect(block.trimEnd().endsWith("</context>")).toBe(true);
    expect(environmentContextBlock()).toBe(block);
  });
});

describe("withEnvironmentBlock", () => {
  const block = '<context name="environment">\nToday: test\n</context>';

  it("appends the block to the first user message only", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "system text" },
      { role: "user", content: "first" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "second" },
    ];
    const result = withEnvironmentBlock(messages, block);
    expect(result[0]).toEqual({ role: "system", content: "system text" });
    expect(result[1].content).toBe(`first\n\n${block}`);
    expect(result[2]).toEqual({ role: "assistant", content: "reply" });
    expect(result[3].content).toBe("second");
    // The input is left alone: the history must not carry the block
    expect(messages[1].content).toBe("first");
  });

  it("adds a text part when the first user message has parts", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [{ type: "text", text: "look at this" }],
      },
    ];
    const result = withEnvironmentBlock(messages, block);
    expect(result[0].content).toEqual([
      { type: "text", text: "look at this" },
      { type: "text", text: block },
    ]);
  });

  it("returns the messages unchanged when there is no user message", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "only system" },
    ];
    expect(withEnvironmentBlock(messages, block)).toBe(messages);
  });
});
