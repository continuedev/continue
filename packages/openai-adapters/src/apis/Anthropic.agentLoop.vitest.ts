import { describe, expect, it } from "vitest";
import { AnthropicApi } from "./Anthropic.js";
import { addCacheControlToLastTwoUserMessages } from "./AnthropicUtils.js";

const toolUse = (id: string) => ({
  id,
  type: "function",
  function: { name: "read", arguments: "{}" },
});

/** An agent loop: the user asks, the model calls a tool twice, results come back. */
const loop = () =>
  JSON.parse(
    JSON.stringify([
      { role: "system", content: "be brief" },
      { role: "user", content: "fix the bug" },
      { role: "assistant", content: null, tool_calls: [toolUse("t1")] },
      { role: "tool", tool_call_id: "t1", content: "file contents one" },
      { role: "assistant", content: null, tool_calls: [toolUse("t2")] },
      { role: "tool", tool_call_id: "t2", content: "file contents two" },
    ]),
  );

const marked = (body: any) =>
  body.messages.map((m: any) =>
    Array.isArray(m.content)
      ? m.content.filter((b: any) => b.cache_control).map((b: any) => b.type)
      : [],
  );

describe("Anthropic adapter: cache markers in an agent loop", () => {
  const api = new AnthropicApi({ provider: "anthropic", apiKey: "k" } as any);
  const build = () =>
    (api as any)._convertBody({ model: "claude-sonnet-4-6", messages: loop() });

  it("marks the last two tool results, which are the last two user-role messages", () => {
    // user(text), assistant, user(tool_result), assistant, user(tool_result)
    expect(marked(build())).toEqual([
      [],
      [],
      ["tool_result"],
      [],
      ["tool_result"],
    ]);
  });

  it("does not mark the first user message once it is three back", () => {
    expect(marked(build())[0]).toEqual([]);
  });

  it("still marks text in a chat, as before", () => {
    const body = (api as any)._convertBody({
      model: "claude-sonnet-4-6",
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: [{ type: "text", text: "one" }] },
        { role: "assistant", content: "ok" },
        { role: "user", content: [{ type: "text", text: "two" }] },
      ],
    });
    expect(marked(body)).toEqual([["text"], [], ["text"]]);
  });
});

describe("addCacheControlToLastTwoUserMessages: blocks that cannot carry a marker", () => {
  const user = (content: any[]) => ({ role: "user" as const, content });

  it("skips empty text and falls back to the block before it", () => {
    const messages: any[] = [
      user([
        { type: "text", text: "real" },
        { type: "text", text: "" },
      ]),
    ];
    addCacheControlToLastTwoUserMessages(messages);
    expect(messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(messages[0].content[1].cache_control).toBeUndefined();
  });

  it("skips a tool result with no content", () => {
    const messages: any[] = [
      user([{ type: "tool_result", tool_use_id: "a", content: "" }]),
    ];
    addCacheControlToLastTwoUserMessages(messages);
    expect(messages[0].content[0].cache_control).toBeUndefined();
  });

  it("leaves a string-content user message alone, and counts it", () => {
    const messages: any[] = [
      user([{ type: "text", text: "first" }]),
      { role: "assistant", content: [{ type: "text", text: "a" }] },
      { role: "user", content: "plain string" },
      { role: "assistant", content: [{ type: "text", text: "b" }] },
      user([{ type: "tool_result", tool_use_id: "z", content: "result" }]),
    ];
    addCacheControlToLastTwoUserMessages(messages);
    expect(messages[2].content).toBe("plain string");
    expect(messages[4].content[0].cache_control).toEqual({ type: "ephemeral" });
    // two user messages were considered (the result and the string), so the
    // first one, three back, is not marked
    expect(messages[0].content[0].cache_control).toBeUndefined();
  });
});
