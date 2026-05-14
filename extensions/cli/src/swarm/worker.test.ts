import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addUserMessage = vi.fn();
const getHistory = vi.fn(() => []);
const getSystemMessage = vi.fn(async () => "base system");
const initializeServices = vi.fn(async () => undefined);
const fireTeammateIdle = vi.fn(async () => ({ blocked: false, results: [] }));
const streamChatResponse = vi.fn(async () => "worker-response");
const serviceContainerGet = vi.fn(async () => ({
  model: { model: "test-model" },
  llmApi: { providerName: "test" },
}));

vi.mock("../services/index.js", () => ({
  initializeServices,
  serviceContainer: {
    get: serviceContainerGet,
  },
  services: {
    chatHistory: {
      addUserMessage,
      getHistory,
    },
    systemMessage: {
      getSystemMessage,
    },
  },
}));

vi.mock("../hooks/fireHook.js", () => ({
  fireTeammateIdle,
}));

vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse,
}));

vi.mock("core/agent/coordinator/WorkerScratchpad.js", () => ({
  appendWorkerScratchpadEntry: vi.fn(async () => undefined),
  readWorkerScratchpad: vi.fn(async () => ""),
}));

vi.mock("core/agent/coordinator/CoordinatorContext.js", () => ({
  buildCoordinatorWorkerSystemMessage: vi.fn(() => "coordinator"),
  getCoordinatorScratchpadPath: vi.fn(() => "/tmp/WORKER_SCRATCHPAD.md"),
}));

describe("swarm worker", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-swarm-worker-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "swarm-worker-session";
    addUserMessage.mockReset();
    getHistory.mockClear();
    getSystemMessage.mockClear();
    initializeServices.mockClear();
    fireTeammateIdle.mockClear();
    streamChatResponse.mockClear();
    serviceContainerGet.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    delete process.env.YUTO_SWARM_WORKER_CONFIG;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("drains a mailbox prompt and records the result", async () => {
    const { appendMailboxMessage, readMailbox } = await import("./mailbox.js");
    const { createSwarmTeam, readSwarmTeam } = await import("./teamRuntime.js");
    const { drainSwarmMailboxOnce, initializeSwarmWorker } = await import(
      "./worker.js"
    );

    await createSwarmTeam({ teamName: "Refactor Squad" });

    const config = {
      agentId: "investigator@refactor-squad",
      agentName: "investigator",
      teamName: "Refactor Squad",
      backend: "process" as const,
      agentType: "Explore",
      agentSystemPrompt: "Investigate only the requested files.",
    };

    await initializeSwarmWorker(config);
    await appendMailboxMessage({
      teamName: config.teamName,
      teammateName: config.agentName,
      message: {
        from: "team-lead",
        text: "Inspect the startup path.",
        timestamp: new Date("2026-05-14T12:00:00.000Z").toISOString(),
        kind: "prompt",
        summary: "Inspect startup",
      },
    });

    const result = await drainSwarmMailboxOnce(config);
    expect(result).toEqual({ processedCount: 1, shouldExit: false });

    expect(initializeServices).toHaveBeenCalledTimes(1);
    expect(addUserMessage).toHaveBeenCalledWith("Inspect the startup path.");
    expect(streamChatResponse).toHaveBeenCalledTimes(1);
    expect(fireTeammateIdle).toHaveBeenCalledWith(
      "investigator",
      "Refactor Squad",
    );

    const team = await readSwarmTeam(config.teamName);
    const teammate = team?.members.find(
      (member) => member.name === "investigator",
    );
    expect(teammate?.status).toBe("completed");
    expect(teammate?.lastPrompt).toBe("Inspect the startup path.");
    expect(teammate?.lastResult).toBe("worker-response");

    const leaderMailbox = await readMailbox(config.teamName, "team-lead");
    expect(leaderMailbox).toHaveLength(1);
    expect(leaderMailbox[0].from).toBe("investigator");
    expect(leaderMailbox[0].text).toBe("worker-response");
  });

  it("treats shutdown control messages as exit signals", async () => {
    const { appendMailboxMessage } = await import("./mailbox.js");
    const { createSwarmTeam, readSwarmTeam } = await import("./teamRuntime.js");
    const { drainSwarmMailboxOnce, initializeSwarmWorker } = await import(
      "./worker.js"
    );

    await createSwarmTeam({ teamName: "Refactor Squad" });

    const config = {
      agentId: "investigator@refactor-squad",
      agentName: "investigator",
      teamName: "Refactor Squad",
      backend: "tmux" as const,
    };

    await initializeSwarmWorker(config);
    await appendMailboxMessage({
      teamName: config.teamName,
      teammateName: config.agentName,
      message: {
        from: "team-lead",
        text: "shutdown",
        timestamp: new Date("2026-05-14T12:05:00.000Z").toISOString(),
        kind: "control",
        metadata: { action: "shutdown" },
      },
    });

    const result = await drainSwarmMailboxOnce(config);
    expect(result).toEqual({ processedCount: 0, shouldExit: true });

    const team = await readSwarmTeam(config.teamName);
    const teammate = team?.members.find(
      (member) => member.name === "investigator",
    );
    expect(teammate?.status).toBe("cancelled");
    expect(teammate?.isActive).toBe(false);
  });
});
