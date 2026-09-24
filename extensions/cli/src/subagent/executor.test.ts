import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceContainer } from "../services/ServiceContainer.js";
import { SERVICE_NAMES } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";

import { executeSubAgent } from "./executor.js";

vi.mock("../stream/streamChatResponse.js", () => ({
  streamChatResponse: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  services: {},
}));

describe("executeSubAgent", () => {
  const agent = {
    model: { name: "test-model" },
    llmApi: {},
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamChatResponse).mockResolvedValue(undefined as any);
  });

  it("keeps the parent session's tool permissions during and after execution", async () => {
    const parentPermissionsState = {
      permissions: {
        policies: [{ tool: "Bash", permission: "ask" as const }],
      },
      currentMode: "normal" as const,
      isHeadless: false,
    };
    serviceContainer.registerValue(
      SERVICE_NAMES.TOOL_PERMISSIONS,
      parentPermissionsState,
    );

    let stateDuringExecution: unknown;
    vi.mocked(streamChatResponse).mockImplementation(async () => {
      stateDuringExecution = await serviceContainer.get(
        SERVICE_NAMES.TOOL_PERMISSIONS,
      );
      return "";
    });

    const result = await executeSubAgent({
      agent,
      prompt: "do a thing",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
    });

    expect(result.success).toBe(true);
    expect(stateDuringExecution).toEqual(parentPermissionsState);
    const stateAfter = await serviceContainer.get(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );
    expect(stateAfter).toEqual(parentPermissionsState);
  });

  it("forwards onToolPermissionRequest to the subagent stream callbacks", async () => {
    const onToolPermissionRequest = vi.fn();

    await executeSubAgent({
      agent,
      prompt: "do a thing",
      parentSessionId: "parent-session",
      abortController: new AbortController(),
      onToolPermissionRequest,
    });

    const callbacks = vi.mocked(streamChatResponse).mock.calls[0][4];
    expect(callbacks?.onToolPermissionRequest).toBe(onToolPermissionRequest);
  });
});
