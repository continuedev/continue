import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceContainer } from "../services/index.js";

import {
  checkToolPermissionApproval,
  executeStreamedToolCalls,
} from "./streamChatResponse.helpers.js";

vi.mock("../services/index.js", () => ({
  services: {
    chatHistory: {
      addToolResult: vi.fn(),
      updateToolStatus: vi.fn(),
    },
  },
  serviceContainer: { get: vi.fn() },
  SERVICE_NAMES: { TOOL_PERMISSIONS: "toolPermissions" },
}));

vi.mock("../tools/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tools/index.js")>()),
  executeToolCall: vi.fn().mockResolvedValue("ran"),
}));

const askBash = { policies: [{ tool: "Bash", permission: "ask" as const }] };
const allowAll = { policies: [{ tool: "*", permission: "allow" as const }] };

function bashCall() {
  return {
    id: "call-1",
    name: "Bash",
    arguments: { command: "echo hi" },
    argumentsStr: '{"command":"echo hi"}',
    tool: { name: "Bash", run: vi.fn() },
  } as any;
}

describe("tool permission fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies an ask-policy tool when no approval callback is registered", async () => {
    const result = await checkToolPermissionApproval(
      askBash,
      bashCall(),
      undefined,
      false,
    );

    expect(result).toEqual({ approved: false, denialReason: "policy" });
  });

  it("denies an ask-policy tool when callbacks exist without onToolPermissionRequest", async () => {
    const result = await checkToolPermissionApproval(
      askBash,
      bashCall(),
      { onContent: vi.fn() },
      false,
    );

    expect(result).toEqual({ approved: false, denialReason: "policy" });
  });

  it("does not run an ask-policy Bash call in a headless-style context with no callback", async () => {
    // Live state is permissive; the run's own snapshot says ask.
    vi.mocked(serviceContainer.get).mockResolvedValue({
      permissions: allowAll,
    } as any);
    const { executeToolCall } = await import("../tools/index.js");

    const { hasRejection, chatHistoryEntries } = await executeStreamedToolCalls(
      [bashCall()],
      { permissionSnapshot: askBash },
      false,
    );

    expect(hasRejection).toBe(true);
    expect(chatHistoryEntries[0].status).toBe("canceled");
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it("checks tool calls against the run's snapshot, not the live state", async () => {
    vi.mocked(serviceContainer.get).mockResolvedValue({
      permissions: allowAll,
    } as any);
    const { executeToolCall } = await import("../tools/index.js");

    // Without a snapshot the live allow-all policy applies
    await executeStreamedToolCalls([bashCall()], {}, false);
    expect(executeToolCall).toHaveBeenCalledTimes(1);

    // With a snapshot the ask policy applies and the call is not run
    vi.mocked(executeToolCall).mockClear();
    await executeStreamedToolCalls(
      [bashCall()],
      { permissionSnapshot: askBash },
      false,
    );
    expect(executeToolCall).not.toHaveBeenCalled();
  });
});
