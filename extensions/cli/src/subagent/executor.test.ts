import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPLORE_MODE_POLICIES,
  VERIFY_MODE_POLICIES,
} from "../permissions/defaultPolicies.js";

import { executeSubAgent } from "./executor.js";

const {
  testContinueHome,
  mockGet,
  mockSet,
  mockStreamChatResponse,
  mockGetSystemMessage,
  mockLoggerDebug,
  mockLoggerError,
} = vi.hoisted(() => ({
  testContinueHome: "/tmp/yutoagentic-subagent-tests",
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockStreamChatResponse: vi.fn(),
  mockGetSystemMessage: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("../services/ServiceContainer.js", () => ({
  serviceContainer: {
    get: mockGet,
    set: mockSet,
  },
}));

vi.mock("../services/index.js", () => ({
  services: {
    systemMessage: {
      getSystemMessage: mockGetSystemMessage,
    },
    chatHistory: {
      isReady: () => true,
    },
  },
}));

vi.mock("../env.js", () => ({
  env: {
    continueHome: testContinueHome,
  },
}));

vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse: mockStreamChatResponse,
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: mockLoggerDebug,
    error: mockLoggerError,
  },
}));

describe("executeSubAgent", () => {
  let observedSystemMessage = "";

  const parentPermissionsState = {
    currentMode: "coordinator" as const,
    permissions: {
      policies: [{ tool: "Read", permission: "allow" as const }],
    },
    isHeadless: false,
  };

  const subAgent = {
    model: {
      name: "explore-agent",
      chatOptions: {
        baseSystemMessage: "Subagent system prompt",
      },
    },
    llmApi: { chatCompletions: { create: vi.fn() } },
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();
    observedSystemMessage = "";
    mockGet.mockResolvedValue(parentPermissionsState);
    mockGetSystemMessage.mockResolvedValue("Base system message");
    mockStreamChatResponse.mockImplementation(async (chatHistory: any[]) => {
      const { services } = await import("../services/index.js");
      observedSystemMessage = await services.systemMessage.getSystemMessage();
      chatHistory.push({
        message: {
          role: "assistant",
          content: "subagent result",
        },
      });
    });

    await fs.rm(testContinueHome, { recursive: true, force: true });
  });

  it("applies explore profile policies and restores parent permissions", async () => {
    const result = await executeSubAgent({
      agent: subAgent,
      prompt: "Explore this codebase",
      profile: "explore",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
    });

    expect(result.success).toBe(true);
    expect(result.response).toBe("subagent result");
    expect(mockGetSystemMessage).toHaveBeenCalledWith("explore");

    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      "toolPermissions",
      expect.objectContaining({
        currentMode: "explore",
        permissions: {
          policies: EXPLORE_MODE_POLICIES,
        },
      }),
    );

    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      "toolPermissions",
      parentPermissionsState,
    );
  });

  it("applies verify profile policies", async () => {
    await executeSubAgent({
      agent: subAgent,
      prompt: "Verify correctness",
      profile: "verify",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
    });

    expect(mockGetSystemMessage).toHaveBeenCalledWith("verify");
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      "toolPermissions",
      expect.objectContaining({
        currentMode: "verify",
        permissions: {
          policies: VERIFY_MODE_POLICIES,
        },
      }),
    );
  });

  it("uses parent mode and parent permissions when no profile is provided", async () => {
    await executeSubAgent({
      agent: subAgent,
      prompt: "Handle task",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
    });

    expect(mockGetSystemMessage).toHaveBeenCalledWith("coordinator");
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      "toolPermissions",
      expect.objectContaining({
        currentMode: "coordinator",
        permissions: parentPermissionsState.permissions,
      }),
    );
  });

  it("creates and updates a coordinator scratchpad for child workers", async () => {
    const parentSessionId = "parent-session";

    await executeSubAgent({
      agent: subAgent,
      prompt: "Investigate the command routing issue",
      parentSessionId,
      abortController: new AbortController(),
    });

    const scratchpadPath = path.join(
      testContinueHome,
      "coordinator",
      parentSessionId,
      "WORKER_SCRATCHPAD.md",
    );
    const scratchpad = await fs.readFile(scratchpadPath, "utf8");

    expect(observedSystemMessage).toContain(
      `Shared scratchpad path: ${scratchpadPath}`,
    );
    expect(observedSystemMessage).toContain("Current scratchpad contents:");
    expect(observedSystemMessage).toContain("# Coordinator Scratchpad");
    expect(scratchpad).toContain("# Coordinator Scratchpad");
    expect(scratchpad).toContain("Investigate the command routing issue");
    expect(scratchpad).toContain("subagent result");
  });

  it("restores parent permissions even when streaming fails", async () => {
    mockStreamChatResponse.mockRejectedValueOnce(new Error("stream failed"));
    const parentSessionId = "parent-session";

    const result = await executeSubAgent({
      agent: subAgent,
      prompt: "Run and fail",
      profile: "verify",
      parentSessionId,
      abortController: new AbortController(),
    });

    const scratchpadPath = path.join(
      testContinueHome,
      "coordinator",
      parentSessionId,
      "WORKER_SCRATCHPAD.md",
    );
    const scratchpad = await fs.readFile(scratchpadPath, "utf8");

    expect(result.success).toBe(false);
    expect(result.error).toBe("stream failed");
    expect(scratchpad).toContain("Status: failed");
    expect(scratchpad).toContain("stream failed");
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      "toolPermissions",
      parentPermissionsState,
    );
  });

  it("records cancelled workers explicitly so the coordinator can continue later", async () => {
    mockStreamChatResponse.mockImplementationOnce(
      async (
        _chatHistory: any[],
        _model: any,
        _llmApi: any,
        controller: AbortController,
      ) => {
        controller.abort();
      },
    );
    const parentSessionId = "parent-session";

    const result = await executeSubAgent({
      agent: subAgent,
      prompt: "Start the investigation and stop midway",
      parentSessionId,
      abortController: new AbortController(),
    });

    const scratchpadPath = path.join(
      testContinueHome,
      "coordinator",
      parentSessionId,
      "WORKER_SCRATCHPAD.md",
    );
    const scratchpad = await fs.readFile(scratchpadPath, "utf8");

    expect(result.success).toBe(false);
    expect(result.status).toBe("cancelled");
    expect(result.cancelled).toBe(true);
    expect(result.response).toContain("cancelled before completion");
    expect(scratchpad).toContain("Status: cancelled");
    expect(scratchpad).toContain("cancelled before completion");
  });
});
