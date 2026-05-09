import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSessionMemoryState: vi.fn(() => ({ extracting: false })),
  shouldExtractSessionMemory: vi.fn(() => false),
  extractSessionMemory: vi.fn(),
  scheduleAutoDream: vi.fn(),
  analyzeContext: vi.fn(() => ({ total: 0 })),
}));

vi.mock("./SessionMemory", () => ({
  createSessionMemoryState: mocks.createSessionMemoryState,
  shouldExtractSessionMemory: mocks.shouldExtractSessionMemory,
  extractSessionMemory: mocks.extractSessionMemory,
}));

vi.mock("./autoDream", () => ({
  scheduleAutoDream: mocks.scheduleAutoDream,
}));

vi.mock("../util/contextAnalysis", () => ({
  analyzeContext: mocks.analyzeContext,
}));

import { runAgent } from "./AgentRunner";

function createLlm(chunks = [{ role: "assistant", content: "Done" }]) {
  return {
    contextLength: 100_000,
    async *streamChat() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as any;
}

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSessionMemoryState.mockReturnValue({ extracting: false });
    mocks.shouldExtractSessionMemory.mockReturnValue(false);
    mocks.analyzeContext.mockReturnValue({ total: 0 });
  });

  it("skips session-memory side effects when session memory is disabled", async () => {
    const llm = createLlm();

    const result = await runAgent({
      prompt: "Summarize the current repo status",
      llm,
      tools: [],
      toolExtras: {} as any,
      sessionMemory: false,
    });

    expect(result.stopReason).toBe("done");
    expect(result.totalTurns).toBe(1);
    expect(result.task.status).toBe("completed");
    expect(mocks.createSessionMemoryState).not.toHaveBeenCalled();
    expect(mocks.extractSessionMemory).not.toHaveBeenCalled();
    expect(mocks.scheduleAutoDream).not.toHaveBeenCalled();
  });

  it("initializes session memory and schedules autodream when enabled", async () => {
    const llm = createLlm();
    const sessionMemoryConfig = {
      minimumMessageTokensToInit: 0,
    };

    const result = await runAgent({
      prompt: "Review the latest implementation",
      llm,
      tools: [],
      toolExtras: {} as any,
      sessionMemory: sessionMemoryConfig,
    });

    expect(result.stopReason).toBe("done");
    expect(result.task.status).toBe("completed");
    expect(mocks.createSessionMemoryState).toHaveBeenCalledTimes(1);
    expect(mocks.createSessionMemoryState).toHaveBeenCalledWith(
      result.sessionId,
      sessionMemoryConfig,
    );
    expect(mocks.extractSessionMemory).not.toHaveBeenCalled();
    expect(mocks.scheduleAutoDream).toHaveBeenCalledWith(
      llm,
      sessionMemoryConfig,
    );
  });

  it("returns an aborted result with a killed task when the abort signal is already set", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const result = await runAgent({
      prompt: "Start and immediately stop",
      llm: createLlm(),
      tools: [],
      toolExtras: {} as any,
      abortController,
      sessionMemory: false,
    });

    expect(result.stopReason).toBe("aborted");
    expect(result.totalTurns).toBe(0);
    expect(result.task.status).toBe("killed");
    expect(mocks.scheduleAutoDream).not.toHaveBeenCalled();
  });
});
