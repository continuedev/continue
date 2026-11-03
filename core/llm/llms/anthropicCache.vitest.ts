import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.mjs";
import { describe, expect, it } from "vitest";
import {
  cacheControlFor,
  markCacheBreakpoints,
  markLastToolForCache,
  resolveCacheParts,
} from "./anthropicCache";

/** Which blocks of each message carry a breakpoint, as "type" or "type+CACHE". */
function shape(messages: MessageParam[]) {
  return messages.map((m) =>
    typeof m.content === "string"
      ? m.content
      : m.content.map((b: any) => b.type + (b.cache_control ? "+CACHE" : "")),
  );
}

const text = (role: "user" | "assistant", t: string): MessageParam => ({
  role,
  content: [{ type: "text", text: t }],
});
const toolUse = (id: string): MessageParam => ({
  role: "assistant",
  content: [{ type: "tool_use", id, name: "read_file", input: {} }],
});
const toolResult = (id: string): MessageParam => ({
  role: "user",
  content: [{ type: "tool_result", tool_use_id: id, content: "file text" }],
});

describe("markCacheBreakpoints", () => {
  it("marks both user messages in a plain chat", () => {
    const msgs = [
      text("user", "q1"),
      text("assistant", "a1"),
      text("user", "q2"),
    ];
    markCacheBreakpoints(msgs);
    expect(shape(msgs)).toEqual([["text+CACHE"], ["text"], ["text+CACHE"]]);
  });

  // The Agent-loop bug: tool results are user-role messages, and they used to
  // use up the count of two without anything being marked.
  it("marks the last two tool results in an Agent loop", () => {
    const msgs = [
      text("user", "fix it"),
      toolUse("t1"),
      toolResult("t1"),
      toolUse("t2"),
      toolResult("t2"),
      toolUse("t3"),
      toolResult("t3"),
    ];
    markCacheBreakpoints(msgs);
    expect(shape(msgs)).toEqual([
      ["text"],
      ["tool_use"],
      ["tool_result"],
      ["tool_use"],
      ["tool_result+CACHE"],
      ["tool_use"],
      ["tool_result+CACHE"],
    ]);
  });

  it("marks the last block when a message mixes tool results and text", () => {
    const msgs: MessageParam[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "x" },
          { type: "text", text: "and also this" },
        ],
      },
    ];
    markCacheBreakpoints(msgs);
    expect(shape(msgs)).toEqual([["tool_result", "text+CACHE"]]);
  });

  it("converts string content instead of skipping it", () => {
    const msgs: MessageParam[] = [{ role: "user", content: "hello" }];
    markCacheBreakpoints(msgs);
    expect(msgs[0].content).toEqual([
      { type: "text", text: "hello", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("never marks a thinking block", () => {
    const msgs: MessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "q" },
          { type: "thinking", thinking: "hm", signature: "s" } as any,
        ],
      },
    ];
    markCacheBreakpoints(msgs);
    expect(shape(msgs)).toEqual([["text+CACHE", "thinking"]]);
  });

  it("skips an empty tool result and moves on to the next message", () => {
    const msgs: MessageParam[] = [
      text("user", "real"),
      toolUse("t1"),
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: [] }],
      },
    ];
    markCacheBreakpoints(msgs);
    expect(shape(msgs)).toEqual([
      ["text+CACHE"],
      ["tool_use"],
      ["tool_result"],
    ]);
  });

  it("marks at most two messages", () => {
    const msgs = [
      text("user", "1"),
      text("assistant", "a"),
      text("user", "2"),
      text("assistant", "b"),
      text("user", "3"),
    ];
    markCacheBreakpoints(msgs);
    const marked = shape(msgs)
      .flat()
      .filter((s) => s.endsWith("+CACHE"));
    expect(marked).toHaveLength(2);
  });

  it("puts the 1-hour lifetime on every breakpoint when asked", () => {
    const msgs = [
      text("user", "q1"),
      text("assistant", "a1"),
      text("user", "q2"),
    ];
    markCacheBreakpoints(msgs, "1h");
    for (const i of [0, 2]) {
      expect((msgs[i].content as any[])[0].cache_control).toEqual({
        type: "ephemeral",
        ttl: "1h",
      });
    }
  });
});

describe("cacheControlFor", () => {
  it("leaves the default lifetime implicit", () => {
    expect(cacheControlFor()).toEqual({ type: "ephemeral" });
    expect(cacheControlFor("5m")).toEqual({ type: "ephemeral" });
  });

  it("names the 1-hour lifetime", () => {
    expect(cacheControlFor("1h")).toEqual({ type: "ephemeral", ttl: "1h" });
  });
});
