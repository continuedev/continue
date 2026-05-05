import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPLORE_MODE_POLICIES,
  VERIFY_MODE_POLICIES,
} from "../permissions/defaultPolicies.js";

import { executeSubAgent } from "./executor.js";

const {
  mockGet,
  mockSet,
  mockStreamChatResponse,
  mockGetSystemMessage,
  mockLoggerDebug,
  mockLoggerError,
} = vi.hoisted(() => ({
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(parentPermissionsState);
    mockGetSystemMessage.mockResolvedValue("Base system message");
    mockStreamChatResponse.mockImplementation(async (chatHistory: any[]) => {
      chatHistory.push({
        message: {
          role: "assistant",
          content: "subagent result",
        },
      });
    });
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

  it("restores parent permissions even when streaming fails", async () => {
    mockStreamChatResponse.mockRejectedValueOnce(new Error("stream failed"));

    const result = await executeSubAgent({
      agent: subAgent,
      prompt: "Run and fail",
      profile: "verify",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("stream failed");
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      "toolPermissions",
      parentPermissionsState,
    );
  });
});
