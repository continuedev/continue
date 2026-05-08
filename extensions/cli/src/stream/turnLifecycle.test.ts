import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockCompleteTask = vi.fn();
  const mockKillTask = vi.fn();
  const mockSchedule = vi.fn();
  const mockContextUpdate = vi.fn();
  const mockGetSystemMessage = vi.fn().mockResolvedValue("system message");
  const mockSessionMemoryRecordToolCalls = vi.fn();
  const mockSessionMemoryMaybeExtract = vi.fn();
  const mockProgressRecordToolCalls = vi.fn();
  const mockTaskRecordToolCall = vi.fn();
  const mockRunTurnLifecycle = vi.fn(
    async (context, handlers: Array<(ctx: unknown) => Promise<unknown>>) => {
      for (const handler of handlers) {
        await handler(context);
      }
      return {};
    },
  );
  const mockFireStop = vi.fn();
  const mockFireTaskCompleted = vi.fn();
  const mockTask = {
    id: "c123",
    type: "chat",
    status: "running",
    description: "Implement lifecycle hooks",
    startTime: 1,
    toolCallCount: 2,
    tokensUsed: 321,
  };

  return {
    mockCompleteTask,
    mockKillTask,
    mockSchedule,
    mockContextUpdate,
    mockGetSystemMessage,
    mockSessionMemoryRecordToolCalls,
    mockSessionMemoryMaybeExtract,
    mockProgressRecordToolCalls,
    mockTaskRecordToolCall,
    mockRunTurnLifecycle,
    mockFireStop,
    mockFireTaskCompleted,
    mockTask,
  };
});

vi.mock("../hooks/fireHook.js", () => ({
  fireStop: mocks.mockFireStop,
  fireTaskCompleted: mocks.mockFireTaskCompleted,
}));

vi.mock("../session.js", () => ({
  getCurrentSession: () => ({ sessionId: "test-session" }),
}));

vi.mock("../services/index.js", () => ({
  services: {
    hooks: { runTurnLifecycle: mocks.mockRunTurnLifecycle },
    featureFlags: { isEnabled: vi.fn() },
    taskState: {
      getCurrentTask: vi.fn(() => mocks.mockTask),
      getState: vi.fn(() => ({ sessionTaskCount: 4 })),
      completeTask: mocks.mockCompleteTask,
      killTask: mocks.mockKillTask,
      recordToolCall: mocks.mockTaskRecordToolCall,
    },
    autoDream: { schedule: mocks.mockSchedule },
    contextAnalysis: { update: mocks.mockContextUpdate },
    systemMessage: { getSystemMessage: mocks.mockGetSystemMessage },
    toolPermissions: {
      getState: vi.fn(() => ({ currentMode: "acceptEdits" })),
    },
    sessionMemory: {
      recordToolCalls: mocks.mockSessionMemoryRecordToolCalls,
      maybeExtract: mocks.mockSessionMemoryMaybeExtract,
    },
    progressTracker: {
      recordToolCalls: mocks.mockProgressRecordToolCalls,
    },
  },
}));

import { services } from "../services/index.js";

import {
  runAfterToolBatchLifecycle,
  runTurnEndLifecycle,
} from "./turnLifecycle.js";

describe("runTurnEndLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires stop and task completed hooks when lifecycle hooks are enabled", async () => {
    vi.mocked(services.featureFlags.isEnabled).mockReturnValue(true);

    await runTurnEndLifecycle({
      chatHistory: [
        { message: { role: "assistant", content: "done" }, contextItems: [] },
      ],
      llmApi: {} as any,
      model: { model: "gpt-test" } as any,
      lastAssistantMessage: "done",
      wasAborted: false,
    });

    expect(mocks.mockCompleteTask).toHaveBeenCalledTimes(1);
    expect(mocks.mockKillTask).not.toHaveBeenCalled();
    expect(mocks.mockFireStop).toHaveBeenCalledWith("done");
    expect(mocks.mockFireTaskCompleted).toHaveBeenCalledWith(
      "c123",
      "Implement lifecycle hooks",
      "Implement lifecycle hooks",
    );
    expect(mocks.mockSchedule).toHaveBeenCalledTimes(1);
    expect(mocks.mockContextUpdate).toHaveBeenCalledWith(
      [{ message: { role: "assistant", content: "done" }, contextItems: [] }],
      { model: "gpt-test" },
      "system message",
    );
  });

  it("skips stop hooks and marks the task killed when aborted", async () => {
    vi.mocked(services.featureFlags.isEnabled).mockReturnValue(false);

    await runTurnEndLifecycle({
      chatHistory: [],
      llmApi: {} as any,
      model: { model: "gpt-test" } as any,
      lastAssistantMessage: "",
      wasAborted: true,
    });

    expect(mocks.mockKillTask).toHaveBeenCalledTimes(1);
    expect(mocks.mockCompleteTask).not.toHaveBeenCalled();
    expect(mocks.mockFireStop).not.toHaveBeenCalled();
    expect(mocks.mockFireTaskCompleted).not.toHaveBeenCalled();
    expect(mocks.mockSchedule).toHaveBeenCalledTimes(1);
  });

  it("records tool-batch bookkeeping consistently for every tool call", async () => {
    const chatHistory = [
      {
        message: { role: "assistant", content: "using tools" },
        contextItems: [],
      },
    ];
    const toolCalls = [
      { name: "read_file", argumentsStr: '{"path":"a.ts"}' },
      { name: "grep_search", argumentsStr: '{"query":"foo"}' },
    ] as any;

    await runAfterToolBatchLifecycle({
      chatHistory,
      llmApi: {} as any,
      model: { model: "gpt-test" } as any,
      toolCalls,
    });

    expect(mocks.mockSessionMemoryRecordToolCalls).toHaveBeenCalledWith(2);
    expect(mocks.mockSessionMemoryMaybeExtract).toHaveBeenCalledWith(
      chatHistory,
      {},
      { model: "gpt-test" },
    );
    expect(mocks.mockProgressRecordToolCalls).toHaveBeenCalledWith([
      { name: "read_file", arguments: '{"path":"a.ts"}' },
      { name: "grep_search", arguments: '{"query":"foo"}' },
    ]);
    expect(mocks.mockTaskRecordToolCall).toHaveBeenCalledTimes(2);
    expect(mocks.mockRunTurnLifecycle).toHaveBeenCalled();
  });
});
