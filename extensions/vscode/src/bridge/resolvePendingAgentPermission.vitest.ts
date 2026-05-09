import { describe, expect, it, vi } from "vitest";

import { PermissionCallbacks } from "./PermissionCallbacks";

describe("resolvePendingAgentPermission", () => {
  it("approves a pending permission request through the callback registry", async () => {
    const { resolvePendingAgentPermission } = await import(
      "./resolvePendingAgentPermission"
    );

    const controlPlaneClient = {
      respondToAgentPermission: vi.fn().mockResolvedValue({
        success: true,
        requestId: "request-1",
        approved: true,
      }),
    };

    const result = await resolvePendingAgentPermission({
      agentSessionId: "agent-1",
      request: {
        requestId: "request-1",
        toolName: "runTerminalCommand",
        toolArgs: { command: "git status" },
        timestamp: 1,
      },
      controlPlaneClient,
      permissionCallbacks: new PermissionCallbacks(),
      dialogLaunchers: {
        showBridgeDialog: vi.fn().mockResolvedValue({
          id: "request-1",
          confirmed: true,
          value: "approve",
        }),
      },
    });

    expect(controlPlaneClient.respondToAgentPermission).toHaveBeenCalledWith(
      "agent-1",
      { requestId: "request-1", approved: true },
    );
    expect(result).toEqual({
      success: true,
      requestId: "request-1",
      approved: true,
    });
  });

  it("rejects a pending permission request when the deny action is chosen", async () => {
    const { resolvePendingAgentPermission } = await import(
      "./resolvePendingAgentPermission"
    );

    const controlPlaneClient = {
      respondToAgentPermission: vi.fn().mockResolvedValue({
        success: true,
        requestId: "request-2",
        approved: false,
      }),
    };

    const result = await resolvePendingAgentPermission({
      agentSessionId: "agent-2",
      request: {
        requestId: "request-2",
        toolName: "Edit",
        toolArgs: { filePath: "src/index.ts" },
        timestamp: 2,
      },
      controlPlaneClient,
      permissionCallbacks: new PermissionCallbacks(),
      dialogLaunchers: {
        showBridgeDialog: vi.fn().mockResolvedValue({
          id: "request-2",
          confirmed: true,
          value: "deny",
        }),
      },
    });

    expect(controlPlaneClient.respondToAgentPermission).toHaveBeenCalledWith(
      "agent-2",
      { requestId: "request-2", approved: false },
    );
    expect(result).toEqual({
      success: true,
      requestId: "request-2",
      approved: false,
    });
  });

  it("cancels a pending permission request when the dialog is dismissed", async () => {
    const { resolvePendingAgentPermission } = await import(
      "./resolvePendingAgentPermission"
    );

    const controlPlaneClient = {
      respondToAgentPermission: vi.fn().mockResolvedValue({
        success: false,
        requestId: "request-3",
        approved: false,
        cancelled: true,
        reason: "dismissed",
      }),
    };

    const result = await resolvePendingAgentPermission({
      agentSessionId: "agent-3",
      request: {
        requestId: "request-3",
        toolName: "Write",
        toolArgs: { filePath: "README.md" },
        timestamp: 3,
      },
      controlPlaneClient,
      permissionCallbacks: new PermissionCallbacks(),
      dialogLaunchers: {
        showBridgeDialog: vi.fn().mockResolvedValue({
          id: "request-3",
          confirmed: false,
        }),
      },
    });

    expect(controlPlaneClient.respondToAgentPermission).toHaveBeenCalledWith(
      "agent-3",
      { requestId: "request-3", reason: "dismissed" },
    );
    expect(result).toEqual({
      success: false,
      requestId: "request-3",
      approved: false,
      cancelled: true,
      reason: "dismissed",
    });
  });
});
