import { constructLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertFromUnifiedHistoryWithSystemMessage } from "core/util/messageConversion.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chatHistorySvc = vi.hoisted(() => ({
  ready: false,
  history: [] as any[],
}));

vi.mock("../services/index.js", () => ({
  services: {
    chatHistory: {
      isReady: () => chatHistorySvc.ready,
      getHistory: () => chatHistorySvc.history,
      addHistoryItem: (item: any) => {
        chatHistorySvc.history = [...chatHistorySvc.history, item];
        return item;
      },
    },
  },
}));

vi.mock("../util/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { injectSteeringMessage } from "./steering.js";

/** A conversation paused at a tool boundary: two tool calls, both answered. */
function historyAtToolBoundary(): ChatHistoryItem[] {
  const toolCall = (id: string, path: string) => ({
    id,
    type: "function" as const,
    function: { name: "Read", arguments: JSON.stringify({ path }) },
  });
  return [
    { message: { role: "user", content: "Tidy up a.ts" }, contextItems: [] },
    {
      message: {
        role: "assistant",
        content: "Reading the files.",
        toolCalls: [toolCall("call_1", "a.ts"), toolCall("call_2", "b.ts")],
      },
      contextItems: [],
      toolCallStates: [
        {
          toolCallId: "call_1",
          toolCall: toolCall("call_1", "a.ts"),
          status: "done",
          parsedArgs: { path: "a.ts" },
          output: [{ name: "Read", description: "", content: "A" }],
        },
        {
          toolCallId: "call_2",
          toolCall: toolCall("call_2", "b.ts"),
          status: "done",
          parsedArgs: { path: "b.ts" },
          output: [{ name: "Read", description: "", content: "B" }],
        },
      ],
    } as ChatHistoryItem,
  ];
}

const steer: ChatHistoryItem = {
  message: { role: "user", content: "Leave b.ts alone" },
  contextItems: [],
};

async function steeredHistory(): Promise<ChatHistoryItem[]> {
  const { chatHistory, injected } = await injectSteeringMessage(
    { onToolBoundary: async () => steer },
    historyAtToolBoundary(),
  );
  expect(injected).toBe(true);
  return chatHistory;
}

describe("injectSteeringMessage", () => {
  beforeEach(() => {
    chatHistorySvc.ready = false;
    chatHistorySvc.history = [];
  });

  it("leaves the history alone without a callback or a message", async () => {
    const history = historyAtToolBoundary();
    expect(await injectSteeringMessage(undefined, history)).toEqual({
      chatHistory: history,
      injected: false,
    });
    expect(
      await injectSteeringMessage(
        { onToolBoundary: async () => undefined },
        history,
      ),
    ).toEqual({ chatHistory: history, injected: false });
  });

  it("writes through ChatHistoryService when it is ready", async () => {
    chatHistorySvc.ready = true;
    chatHistorySvc.history = historyAtToolBoundary();
    const { chatHistory } = await injectSteeringMessage(
      { onToolBoundary: async () => steer },
      [],
    );
    expect(chatHistory.at(-1)).toBe(steer);
    expect(chatHistorySvc.history.at(-1)).toBe(steer);
  });

  it("builds a valid OpenAI-style history: tool messages, then the user message", async () => {
    const messages = convertFromUnifiedHistoryWithSystemMessage(
      await steeredHistory(),
      "system",
    );
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "tool",
      "user",
    ]);
    // Every tool message still follows the assistant message that called it.
    expect((messages[3] as any).tool_call_id).toBe("call_1");
    expect((messages[4] as any).tool_call_id).toBe("call_2");
    expect(messages[5].content).toBe("Leave b.ts alone");
  });

  it("becomes one Anthropic user turn with every tool_result before the text", async () => {
    const messages = convertFromUnifiedHistoryWithSystemMessage(
      await steeredHistory(),
      "system",
    );
    const api = constructLlmApi({
      provider: "anthropic",
      apiKey: "test",
    } as any) as any;
    const converted = api._convertMessages(messages);

    expect(converted.map((m: any) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(converted[2].content.map((b: any) => b.type)).toEqual([
      "tool_result",
      "tool_result",
      "text",
    ]);
    expect(converted[2].content[2].text).toBe("Leave b.ts alone");
  });

  it("becomes one Bedrock user turn with every toolResult before the text", async () => {
    const messages = convertFromUnifiedHistoryWithSystemMessage(
      await steeredHistory(),
      "system",
    );
    const api = constructLlmApi({
      provider: "bedrock",
      env: { region: "us-east-1" },
    } as any) as any;
    const converted = api._convertMessages(messages, new Set(["Read"]));

    expect(converted.map((m: any) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    const lastTurn = converted[2].content;
    expect(lastTurn[0].toolResult.toolUseId).toBe("call_1");
    expect(lastTurn[1].toolResult.toolUseId).toBe("call_2");
    expect(lastTurn[2]).toEqual({ text: "Leave b.ts alone" });
    // Roles alternate, which Bedrock's Converse API requires.
    for (let i = 1; i < converted.length; i++) {
      expect(converted[i].role).not.toBe(converted[i - 1].role);
    }
  });
});
