import type { AddressInfo } from "net";

import type { ChatHistoryItem } from "core/index.js";
import express from "express";
import type { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageQueue } from "../stream/messageQueue.js";

import type { ServerState } from "./serve.helpers.js";
import { registerMessageRoutes } from "./serve.messages.js";

// The real serve routes, queue, agent loop and steering; only the model, the
// tool runner and the services around them are stand-ins.
const svc = vi.hoisted(() => ({
  history: [] as any[],
  // Runs while the fake tool executes, i.e. while the turn is in progress
  duringTool: null as null | (() => Promise<void>),
}));

vi.mock("../services/index.js", () => {
  const push = (item: any) => {
    svc.history = [...svc.history, item];
    return item;
  };
  const say = (role: string) => (content: string) =>
    push({ message: { role, content }, contextItems: [] });
  return {
    services: {
      systemMessage: {
        getSystemMessage: vi.fn(() => Promise.resolve("System message")),
      },
      toolPermissions: {
        getState: vi.fn(() => ({ currentMode: "enabled" })),
        isHeadless: vi.fn(() => false),
      },
      chatHistory: {
        isReady: () => true,
        getHistory: () => svc.history,
        setHistory: (h: any[]) => {
          svc.history = h;
        },
        addHistoryItem: push,
        addUserMessage: say("user"),
        addAssistantMessage: say("assistant"),
        addSystemMessage: say("system"),
      },
    },
  };
});

vi.mock("../session.js", () => ({
  updateSessionHistory: vi.fn(),
  trackSessionUsage: vi.fn(),
  // No loop in these sessions
  getSessionLoop: vi.fn(() => undefined),
  getCompleteStateSnapshot: (
    session: any,
    isProcessing: boolean,
    messageQueueLength: number,
    pendingPermission: any,
  ) => ({ session, isProcessing, messageQueueLength, pendingPermission }),
}));

vi.mock("../hooks/promptHook.js", () => ({
  runUserPromptSubmitHooks: vi.fn(async (prompt: string) => ({ prompt })),
  describePromptBlocked: (reason: string) => `Blocked: ${reason}`,
}));

vi.mock("../tools/reportFailure.js", () => ({
  reportFailureTool: { run: vi.fn() },
}));

vi.mock("../util/exit.js", () => ({
  updateAgentMetadata: vi.fn(),
}));

vi.mock("../compaction.js", () => ({
  compactChatHistory: vi.fn(),
  pruneLastMessage: vi.fn((history) => history.slice(0, -1)),
  shouldAutoCompact: vi.fn(),
  getAutoCompactMessage: vi.fn(() => "Auto-compacting..."),
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

// The tool runner records the call and its result, as handleToolCalls does,
// and gives the test a moment inside the tool to post to the server.
vi.mock("../stream/handleToolCalls.js", () => ({
  getRequestTools: vi.fn(() => Promise.resolve([])),
  handleToolCalls: vi.fn(async ({ toolCalls, content }: any) => {
    if (toolCalls.length === 0) {
      svc.history = [
        ...svc.history,
        { message: { role: "assistant", content }, contextItems: [] },
      ];
      return false;
    }
    svc.history = [
      ...svc.history,
      {
        message: {
          role: "assistant",
          content: content ?? "",
          toolCalls: toolCalls.map((tc: any) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        },
        contextItems: [],
      },
    ];
    await svc.duringTool?.();
    svc.history = [
      ...svc.history,
      {
        message: {
          role: "tool",
          content: "contents of a.ts",
          toolCallId: toolCalls[0].id,
        },
        contextItems: [],
      },
    ];
    return false;
  }),
}));

vi.mock(
  "../stream/streamChatResponse.compactionHelpers.js",
  async (importOriginal) => ({
    // The real auto-continuation logic: it decides when a turn ends
    handleAutoContinuation: (
      await importOriginal<
        typeof import("../stream/streamChatResponse.compactionHelpers.js")
      >()
    ).handleAutoContinuation,
    handlePreApiCompaction: vi.fn((chatHistory) =>
      Promise.resolve({ chatHistory, wasCompacted: false }),
    ),
    handlePostToolValidation: vi.fn((_, chatHistory) =>
      Promise.resolve({ chatHistory, wasCompacted: false }),
    ),
    handleNormalAutoCompaction: vi.fn((chatHistory) =>
      Promise.resolve({ chatHistory, wasCompacted: false }),
    ),
  }),
);

function chunk(delta: any, finish: string | null = null): ChatCompletionChunk {
  return {
    id: "test",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finish as any }],
  };
}

const toolCall = [
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
const text = (content: string) => [chunk({ content }, "stop")];

type Step = ChatCompletionChunk[] | (() => Promise<ChatCompletionChunk[]>);

/** A model that answers each request with the next step. */
function scriptedModel(...steps: Step[]) {
  const requests: ChatHistoryItem[][] = [];
  const llmApi = {
    chatCompletionStream: vi.fn(async function* () {
      requests.push([...svc.history]);
      const step = steps[requests.length - 1] ?? text("extra");
      const chunks = typeof step === "function" ? await step() : step;
      for (const c of chunks) yield c;
    }),
  };
  return { llmApi, requests };
}

const roles = (history: ChatHistoryItem[]) =>
  history.map((h) => h.message.role);
const lastContent = (history: ChatHistoryItem[]) =>
  history[history.length - 1]?.message.content;

describe("cn serve: POST /message with steer", () => {
  let server: ReturnType<express.Application["listen"]> | null = null;
  let baseUrl = "";
  let state: ServerState;
  let idle: Promise<void>;

  async function start(llmApi: unknown) {
    state = {
      session: { history: [] } as any,
      config: {},
      model: {
        provider: "openai",
        name: "gpt-4",
        model: "gpt-4",
        defaultCompletionOptions: { contextLength: 8192, maxTokens: 2048 },
      },
      isProcessing: false,
      lastActivity: Date.now(),
      currentAbortController: null,
      serverRunning: true,
      pendingPermission: null,
    };
    let markIdle = () => {};
    idle = new Promise<void>((resolve) => {
      markIdle = resolve;
    });
    const app = express();
    app.use(express.json());
    registerMessageRoutes(app, {
      state,
      llmApi,
      syncSessionHistory: () => {},
      onIdle: async () => markIdle(),
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  }

  async function post(body: unknown) {
    const res = await fetch(`${baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  const getState = async () => (await fetch(`${baseUrl}/state`)).json();

  beforeEach(() => {
    svc.history = [];
    svc.duringTool = null;
    messageQueue.clear();
    messageQueue.resume();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it("delivers a steered message after the tool result, in the same turn", async () => {
    const { llmApi, requests } = scriptedModel(toolCall, text("using b.ts"));
    await start(llmApi);

    let steerResponse: any;
    let queueWhileSteered: any;
    svc.duringTool = async () => {
      steerResponse = await post({ message: "use b.ts instead", steer: true });
      queueWhileSteered = await getState();
    };

    expect((await post({ message: "read a.ts" })).body).toMatchObject({
      queued: true,
      steered: false,
    });
    await idle;

    expect(steerResponse.body).toMatchObject({ queued: true, steered: true });
    // GET /state shows the message waiting for the boundary
    expect(queueWhileSteered).toMatchObject({
      isProcessing: true,
      messageQueueLength: 1,
      steerRequested: true,
      messageQueuePaused: false,
      messageQueue: [{ message: "use b.ts instead", steer: true }],
    });

    // One turn: the second model request already has the message, directly
    // after the tool result, and there is no third request for it.
    expect(requests).toHaveLength(2);
    expect(roles(requests[1])).toEqual(["user", "assistant", "tool", "user"]);
    expect(lastContent(requests[1])).toBe("use b.ts instead");
    expect((await getState()).messageQueue).toEqual([]);
  });

  it("holds a plain message until the turn ends", async () => {
    const { llmApi, requests } = scriptedModel(
      toolCall,
      text("done with a.ts"),
      text("now the follow-up"),
    );
    await start(llmApi);

    let plainResponse: any;
    let queueWhileWaiting: any;
    svc.duringTool = async () => {
      plainResponse = await post({ message: "then look at b.ts" });
      queueWhileWaiting = await getState();
    };

    await post({ message: "read a.ts" });
    await idle;

    expect(plainResponse.body).toMatchObject({ queued: true, steered: false });
    expect(queueWhileWaiting).toMatchObject({
      steerRequested: false,
      messageQueue: [{ message: "then look at b.ts", steer: false }],
    });

    // The request after the tool result does not see it; it starts the next
    // turn once the first has finished.
    expect(requests).toHaveLength(3);
    expect(roles(requests[1])).toEqual(["user", "assistant", "tool"]);
    expect(roles(requests[2])).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
      "user",
    ]);
    expect(lastContent(requests[2])).toBe("then look at b.ts");
  });

  it("sends a steered message at the end of the turn when no tool boundary comes", async () => {
    let steerResponse: any;
    const { llmApi, requests } = scriptedModel(async () => {
      steerResponse = await post({ message: "also do c", steer: true });
      return text("plain answer");
    }, text("doing c"));
    await start(llmApi);

    await post({ message: "answer without tools" });
    await idle;

    expect(steerResponse.body).toMatchObject({ steered: true });
    expect(requests).toHaveLength(2);
    expect(roles(requests[1])).toEqual(["user", "assistant", "user"]);
    expect(lastContent(requests[1])).toBe("also do c");
  });

  it("treats steer as a plain message when nothing is running", async () => {
    const { llmApi, requests } = scriptedModel(text("hi"));
    await start(llmApi);

    const res = await post({ message: "hello", steer: true });
    await idle;

    expect(res.body).toMatchObject({ queued: true, steered: false });
    expect(requests).toHaveLength(1);
    expect(lastContent(requests[0])).toBe("hello");
  });

  it("rejects a steer value that is not a boolean", async () => {
    const { llmApi } = scriptedModel();
    await start(llmApi);

    const res = await post({ message: "hello", steer: "yes" });

    expect(res.status).toBe(400);
    expect(messageQueue.getQueueLength()).toBe(0);
  });
});
