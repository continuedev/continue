import { describe, expect, it } from "vitest";

import { ChatMessage } from "../index.js";
import { compileChatMessages } from "./countTokens";

const big = (word: string) => `${word} `.repeat(600);

const call = (id: string): ChatMessage => ({
  role: "assistant",
  content: "",
  toolCalls: [
    { id, type: "function", function: { name: "read", arguments: "{}" } },
  ],
});
const result = (id: string, text = "ok"): ChatMessage => ({
  role: "tool",
  content: text,
  toolCallId: id,
});

const compile = (msgs: ChatMessage[], knownContextLength = 1300) =>
  compileChatMessages({
    modelName: "gpt-4",
    msgs,
    knownContextLength,
    maxTokens: 200,
    supportsImages: false,
  });

describe("compileChatMessages pruning in a tool loop", () => {
  it("keeps the user's last message when the trailing sequence is tool calls", () => {
    const { compiledChatMessages, didPrune } = compile([
      { role: "system", content: "sys" },
      { role: "user", content: big("old") },
      { role: "assistant", content: big("answer") },
      { role: "user", content: "LATEST QUESTION " + big("q") },
      call("t1"),
      result("t1", big("file")),
      call("t2"),
      result("t2"),
    ]);
    expect(didPrune).toBe(true);
    const users = compiledChatMessages.filter((m) => m.role === "user");
    expect(users).toHaveLength(1);
    expect(String(users[0].content)).toContain("LATEST QUESTION");
    // The final tool round is still there, after the user's turn.
    expect(compiledChatMessages.at(-1)).toMatchObject({ toolCallId: "t2" });
  });

  it("prunes older tool rounds after the user's turn in call/result pairs", () => {
    const { compiledChatMessages } = compile([
      { role: "user", content: "LATEST QUESTION" },
      call("t1"),
      result("t1", big("first")),
      call("t2"),
      result("t2", big("second")),
      call("t3"),
      result("t3"),
    ]);
    expect(compiledChatMessages[0]).toMatchObject({ role: "user" });
    // No tool result is left without the call that produced it.
    const callIds = new Set(
      compiledChatMessages.flatMap((m) =>
        m.role === "assistant" ? (m.toolCalls ?? []).map((c) => c.id) : [],
      ),
    );
    for (const m of compiledChatMessages) {
      if (m.role === "tool") expect(callIds.has(m.toolCallId)).toBe(true);
    }
    expect(compiledChatMessages.at(-1)).toMatchObject({ toolCallId: "t3" });
  });

  it("still prunes oldest-first when the last message is the user's", () => {
    const { compiledChatMessages, didPrune } = compile(
      [
        { role: "user", content: big("old") },
        { role: "assistant", content: big("answer") },
        { role: "user", content: "NOW" },
      ],
      1200,
    );
    expect(didPrune).toBe(true);
    expect(compiledChatMessages.at(-1)).toMatchObject({
      role: "user",
      content: "NOW",
    });
  });

  it("does not prune when everything fits", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "hi" },
      call("t1"),
      result("t1"),
    ];
    const { compiledChatMessages, didPrune } = compile(msgs, 100_000);
    expect(didPrune).toBe(false);
    expect(compiledChatMessages).toHaveLength(3);
  });
});

describe("compileChatMessages with the task list block at the tail", () => {
  const list: ChatMessage = {
    role: "user",
    content: "<task_list>\n[>] 1. Read the files\n</task_list>",
  };

  it("keeps the block last and still protects the real last turn", () => {
    const { compiledChatMessages, didPrune } = compile([
      { role: "system", content: "sys" },
      { role: "user", content: big("old") },
      { role: "assistant", content: big("answer") },
      { role: "user", content: "LATEST QUESTION " + big("q") },
      call("t1"),
      result("t1", big("file")),
      call("t2"),
      result("t2"),
      list,
    ]);
    expect(didPrune).toBe(true);
    expect(compiledChatMessages.at(-1)).toEqual(list);
    expect(compiledChatMessages.at(-2)).toMatchObject({ toolCallId: "t2" });
    const users = compiledChatMessages.filter(
      (m) => m.role === "user" && m.content !== list.content,
    );
    expect(String(users.at(-1)?.content)).toContain("LATEST QUESTION");
  });

  it("is left alone when nothing needs pruning", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "hi" },
      call("t1"),
      result("t1"),
      list,
    ];
    const { compiledChatMessages, didPrune } = compile(msgs, 100_000);
    expect(didPrune).toBe(false);
    expect(compiledChatMessages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "user",
    ]);
    expect(compiledChatMessages.at(-1)).toEqual(list);
  });
});
