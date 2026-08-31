import { expect, test, vi } from "vitest";

import { ChatMessage, ILLM } from "../index.js";
import { ShadowChatDb } from "../data/shadowChatDb.js";
import { tokenOptimizedStreamChat } from "./tokenOptimizedChat.js";

// The DB is incidental to what these tests cover (message construction), and
// hitting real SQLite would make them order-dependent.
vi.mock("../data/shadowChatDb.js", () => ({
  ShadowChatDb: {
    saveMessages: vi.fn(async () => {}),
    saveToolCall: vi.fn(async () => {}),
    saveTurn: vi.fn(async () => {}),
    getCurrentTurnIndex: vi.fn(async () => 0),
  },
}));

/** Captures the messages handed to the model on each turn. */
function recordingLlm(turns: ChatMessage[][]) {
  const sentMessages: ChatMessage[][] = [];
  let turnIndex = 0;

  const llm = {
    providerName: "anthropic",
    model: "fake",
    title: "Fake",
    streamChat: async function* (messages: ChatMessage[]) {
      sentMessages.push(messages);
      const chunks = turns[Math.min(turnIndex, turns.length - 1)];
      turnIndex += 1;
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as ILLM;

  return { llm, sentMessages };
}

async function drain(gen: AsyncGenerator<ChatMessage, unknown>) {
  const out: ChatMessage[] = [];
  let next = await gen.next();
  while (!next.done) {
    out.push(next.value);
    next = await gen.next();
  }
  return out;
}

test("tokenOptimizedStreamChat drops earlier turns but keeps the system and current user message", async () => {
  const { llm, sentMessages } = recordingLlm([
    [{ role: "assistant", content: "done" }],
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: "SYSTEM" },
    { role: "user", content: "old question" },
    { role: "assistant", content: "old answer" },
    { role: "user", content: "new question" },
  ];

  await drain(
    tokenOptimizedStreamChat(
      llm,
      messages,
      new AbortController().signal,
      {},
      "session-1",
      20,
    ),
  );

  expect(sentMessages[0].map((m) => m.content)).toEqual([
    "SYSTEM",
    "new question",
  ]);
});

test("tokenOptimizedStreamChat carries the current turn's tool results into the next request", async () => {
  // The regression: without the current-turn tail, the model sees only
  // [system, user] again - its tool result is gone - so it re-emits the same
  // tool call forever. For spawn_subagents that re-runs the whole task.
  const { llm, sentMessages } = recordingLlm([
    [{ role: "assistant", content: "done" }],
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: "SYSTEM" },
    { role: "user", content: "spawn some subagents" },
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "spawn_subagents", arguments: "{}" },
        },
      ],
    },
    { role: "tool", content: "subagent report", toolCallId: "call-1" },
  ];

  await drain(
    tokenOptimizedStreamChat(
      llm,
      messages,
      new AbortController().signal,
      {},
      "session-2",
      20,
    ),
  );

  const sent = sentMessages[0];
  expect(sent.map((m) => m.role)).toEqual([
    "system",
    "user",
    "assistant",
    "tool",
  ]);
  expect(sent.at(-1)).toMatchObject({
    role: "tool",
    toolCallId: "call-1",
    content: "subagent report",
  });
});

test("tokenOptimizedStreamChat keeps parallel tool calls separate when index is present", async () => {
  // Two calls opened with ids, then argument fragments carrying only index -
  // the OpenAI streaming shape. Keying on "most recently seen id" merged both
  // fragment streams into call-2.
  const { llm } = recordingLlm([
    [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call-1",
            index: 0,
            type: "function",
            function: { name: "read_file", arguments: '{"a' },
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call-2",
            index: 1,
            type: "function",
            function: { name: "grep_search", arguments: '{"b' },
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { index: 0, type: "function", function: { arguments: '":1}' } },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { index: 1, type: "function", function: { arguments: '":2}' } },
        ],
      },
    ],
  ]);

  const yielded = await drain(
    tokenOptimizedStreamChat(
      llm,
      [
        { role: "system", content: "SYSTEM" },
        { role: "user", content: "go" },
      ],
      new AbortController().signal,
      {},
      "session-3",
      20,
    ),
  );

  // Both are non-shadow tools, so ultra mode passes the chunks through for the
  // client to execute; the point here is that extraction didn't merge them.
  const allToolCalls = yielded.flatMap((m: any) => m.toolCalls ?? []);
  const ids = new Set(allToolCalls.map((tc: any) => tc.id).filter(Boolean));
  expect(ids).toEqual(new Set(["call-1", "call-2"]));
});

test("tokenOptimizedStreamChat records the turn even when the model throws", async () => {
  const llm = {
    providerName: "anthropic",
    model: "fake",
    streamChat: async function* () {
      throw new Error("boom");
    },
  } as unknown as ILLM;

  await expect(
    drain(
      tokenOptimizedStreamChat(
        llm,
        [
          { role: "system", content: "SYSTEM" },
          { role: "user", content: "go" },
        ],
        new AbortController().signal,
        {},
        "session-4",
        20,
      ),
    ),
  ).rejects.toThrow("boom");

  expect(ShadowChatDb.saveTurn).toHaveBeenCalled();
});
