import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import type { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { streamChatResponse } from "./streamChatResponse.js";

const svcState = vi.hoisted(() => ({ history: [] as any[] }));

vi.mock("../compaction.js", () => ({
  compactChatHistory: vi.fn(),
  pruneLastMessage: vi.fn((history) => history.slice(0, -1)),
  shouldAutoCompact: vi.fn(),
  getAutoCompactMessage: vi.fn(() => "Auto-compacting..."),
}));

vi.mock("../session.js", () => ({
  updateSessionHistory: vi.fn(),
  trackSessionUsage: vi.fn(),
}));

vi.mock("../util/tokenizer.js", () => ({
  countChatHistoryItemTokens: vi.fn(() => 100),
  validateContextLength: vi.fn(() => ({ isValid: true })),
}));

vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    logApiRequest: vi.fn(),
    recordResponseTime: vi.fn(),
    recordTokenUsage: vi.fn(),
    recordCost: vi.fn(),
  },
}));

vi.mock("../util/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: {
      getSystemMessage: vi.fn(() => Promise.resolve("System message")),
    },
    toolPermissions: {
      getState: vi.fn(() => ({ currentMode: "enabled" })),
      isHeadless: vi.fn(() => false),
    },
    chatHistory: {
      isReady: vi.fn(() => true),
      getHistory: vi.fn(() => svcState.history),
      setHistory: vi.fn(),
      addUserMessage: vi.fn(),
      addHistoryItem: vi.fn((item: any) => {
        svcState.history = [...svcState.history, item];
        return item;
      }),
    },
  },
}));

vi.mock("./handleToolCalls.js", () => ({
  handleToolCalls: vi.fn(() => Promise.resolve(false)),
  getRequestTools: vi.fn(() => Promise.resolve([])),
}));

vi.mock("./streamChatResponse.compactionHelpers.js", () => ({
  handlePreApiCompaction: vi.fn((chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
  handlePostToolValidation: vi.fn((_, chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
  handleNormalAutoCompaction: vi.fn((chatHistory) =>
    Promise.resolve({ chatHistory, wasCompacted: false }),
  ),
}));

function chunk(delta: any, finish: string | null = null): ChatCompletionChunk {
  return {
    id: "test",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finish as any }],
  };
}

const toolCallChunks = [
  chunk({
    tool_calls: [
      {
        index: 0,
        id: "call_1",
        type: "function",
        function: { name: "Read", arguments: '{"path":"a.ts"}' },
      },
    ],
  }),
  chunk({}, "tool_calls"),
];

describe("streamChatResponse - steering at the tool boundary", () => {
  const model: ModelConfig = {
    provider: "openai",
    name: "gpt-4",
    model: "gpt-4",
    defaultCompletionOptions: { contextLength: 8192, maxTokens: 2048 },
  } as any;

  let chatHistory: ChatHistoryItem[];
  let abortController: AbortController;

  beforeEach(() => {
    vi.clearAllMocks();
    chatHistory = convertToUnifiedHistory([{ role: "user", content: "Hello" }]);
    svcState.history = [...chatHistory];
    abortController = new AbortController();
  });

  function llmReturning(...responses: ChatCompletionChunk[][]) {
    const historiesSeen: ChatHistoryItem[][] = [];
    let call = 0;
    const api = {
      chatCompletionStream: vi.fn().mockImplementation(async function* () {
        historiesSeen.push([...svcState.history]);
        const chunks = responses[call++] ?? [chunk({ content: "done" })];
        for (const c of chunks) yield c;
      }),
    } as unknown as BaseLlmApi;
    return { api, historiesSeen };
  }

  it("asks for a steering message after a round of tool calls, and the next request sees it", async () => {
    const steer: ChatHistoryItem = {
      message: { role: "user", content: "use b.ts instead" },
      contextItems: [],
    };
    const onToolBoundary = vi
      .fn()
      .mockResolvedValueOnce(steer)
      .mockResolvedValue(undefined);
    const { api, historiesSeen } = llmReturning(toolCallChunks, [
      chunk({ content: "ok, b.ts" }),
    ]);

    await streamChatResponse(chatHistory, model, api, abortController, {
      onToolBoundary,
    });

    expect(onToolBoundary).toHaveBeenCalledTimes(1);
    expect(historiesSeen).toHaveLength(2);
    expect(historiesSeen[0]).not.toContain(steer);
    expect(historiesSeen[1].at(-1)).toBe(steer);
  });

  it("does not ask when the reply had no tool calls (the turn ends instead)", async () => {
    const onToolBoundary = vi.fn();
    const { api } = llmReturning([chunk({ content: "just text" })]);

    await streamChatResponse(chatHistory, model, api, abortController, {
      onToolBoundary,
    });

    expect(onToolBoundary).not.toHaveBeenCalled();
  });

  it("does not ask after the run was stopped", async () => {
    const onToolBoundary = vi.fn();
    const { handleToolCalls } = await import("./handleToolCalls.js");
    vi.mocked(handleToolCalls).mockImplementationOnce(async () => {
      abortController.abort();
      return false;
    });
    const { api } = llmReturning(toolCallChunks);

    await streamChatResponse(chatHistory, model, api, abortController, {
      onToolBoundary,
    });

    expect(onToolBoundary).not.toHaveBeenCalled();
  });

  it("reports the model as streaming only while its reply streams, never while tools run", async () => {
    // "Steer now" interrupts only while this is true
    const events: string[] = [];
    const { handleToolCalls } = await import("./handleToolCalls.js");
    vi.mocked(handleToolCalls).mockImplementationOnce(async () => {
      events.push("tools");
      return false;
    });
    const { api } = llmReturning(toolCallChunks, [chunk({ content: "ok" })]);

    await streamChatResponse(chatHistory, model, api, abortController, {
      onModelStreaming: (streaming) =>
        events.push(streaming ? "model" : "model done"),
    });

    expect(events).toEqual([
      "model",
      "model done",
      "tools",
      "model",
      "model done",
    ]);
  });

  it("reports the model stream ended when it fails", async () => {
    const events: boolean[] = [];
    const api = {
      chatCompletionStream: vi.fn().mockImplementation(async function* () {
        yield chunk({ content: "partial" });
        throw new Error("connection reset");
      }),
    } as unknown as BaseLlmApi;

    await expect(
      streamChatResponse(chatHistory, model, api, abortController, {
        onModelStreaming: (streaming) => events.push(streaming),
      }),
    ).rejects.toThrow();
    expect(events).toEqual([true, false]);
  });
});
