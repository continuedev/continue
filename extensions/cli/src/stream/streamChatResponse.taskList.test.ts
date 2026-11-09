import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem, TaskPlan } from "core/index.js";
import type { ChatCompletionTool } from "openai/resources.mjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processStreamingResponse } from "./streamChatResponse.js";

const store = vi.hoisted(() => ({ plan: undefined as TaskPlan | undefined }));
vi.mock("../session.js", async () => {
  const actual = await vi.importActual<object>("../session.js");
  return {
    ...actual,
    getSessionTaskPlan: () => store.plan,
    trackSessionUsage: vi.fn(),
  };
});

vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: { getSystemMessage: vi.fn() },
    toolPermissions: {
      getState: vi.fn(() => ({ currentMode: "enabled" })),
      isHeadless: vi.fn(() => false),
    },
    chatHistory: { isReady: vi.fn(() => false) },
  },
}));

vi.mock("../util/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const model = {
  model: "test-model",
  defaultCompletionOptions: { contextLength: 100_000, maxTokens: 100 },
} as ModelConfig;

const taskListTool: ChatCompletionTool = {
  type: "function",
  function: { name: "TaskList", parameters: { type: "object" } },
};
const readTool: ChatCompletionTool = {
  type: "function",
  function: { name: "Read", parameters: { type: "object" } },
};

const history: ChatHistoryItem[] = [
  { message: { role: "user", content: "fix it" }, contextItems: [] },
];

async function sentMessages(tools: ChatCompletionTool[]) {
  const llmApi = {
    chatCompletionStream: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: "ok" } }] };
      },
    }),
  } as unknown as BaseLlmApi;
  await processStreamingResponse({
    chatHistory: history,
    model,
    llmApi,
    abortController: new AbortController(),
    systemMessage: "sys",
    tools,
  });
  return vi.mocked(llmApi.chatCompletionStream).mock.calls[0][0]
    .messages as Array<{ role: string; content: unknown }>;
}

describe("the task list in the CLI request", () => {
  beforeEach(() => {
    store.plan = {
      items: [
        { id: "1", text: "Read", status: "completed" },
        { id: "2", text: "Fix", status: "in_progress" },
      ],
      updatedAt: "2026-11-06T12:00:00.000Z",
    };
  });

  it("is the last message, after the history", async () => {
    const messages = await sentMessages([readTool, taskListTool]);
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "user"]);
    // The first user message carries the environment block (date, git status)
    const first = String(messages[1].content);
    expect(first.startsWith('fix it\n\n<context name="environment">')).toBe(
      true,
    );
    const tail = String(messages.at(-1)?.content);
    expect(tail.startsWith("<task_list>\n")).toBe(true);
    expect(tail).toContain("[>] 2. Fix");
    expect(String(messages[0].content)).not.toContain("<task_list>");
  });

  it("is left out when the TaskList tool is not offered", async () => {
    const messages = await sentMessages([readTool]);
    expect(messages.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("is left out when there is no list", async () => {
    store.plan = undefined;
    const messages = await sentMessages([taskListTool]);
    expect(messages).toHaveLength(2);
  });
});
