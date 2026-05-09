import { describe, expect, it, vi } from "vitest";

import { PermissionCallbacks } from "./PermissionCallbacks";

describe("PermissionCallbacks", () => {
  it("resolves a registered callback and cleans it up", async () => {
    const callbacks = new PermissionCallbacks();
    const request = {
      requestId: "request-1",
      toolName: "runTerminalCommand",
      toolArgs: { command: "git status" },
      timestamp: 1,
    };

    const pending = callbacks.register(request);

    expect(callbacks.size).toBe(1);
    expect(callbacks.getPendingRequest("request-1")).toEqual(request);

    expect(callbacks.resolve({ requestId: "request-1", approved: true })).toBe(
      true,
    );
    await expect(pending).resolves.toEqual({
      success: true,
      requestId: "request-1",
      approved: true,
    });
    expect(callbacks.size).toBe(0);
  });

  it("cancels a pending callback and notifies the cancel hook", async () => {
    const callbacks = new PermissionCallbacks();
    const onCancel = vi.fn();

    const pending = callbacks.register(
      {
        requestId: "request-2",
        toolName: "runTerminalCommand",
        toolArgs: { command: "npm install" },
        timestamp: 2,
      },
      { onCancel },
    );

    expect(
      callbacks.cancel({ requestId: "request-2", reason: "view disposed" }),
    ).toBe(true);
    expect(onCancel).toHaveBeenCalledWith({
      requestId: "request-2",
      reason: "view disposed",
    });
    await expect(pending).resolves.toEqual({
      success: false,
      requestId: "request-2",
      approved: false,
      cancelled: true,
      reason: "view disposed",
    });
  });

  it("cancels all pending callbacks", async () => {
    const callbacks = new PermissionCallbacks();

    const pendingOne = callbacks.register({
      requestId: "request-3",
      toolName: "readFile",
      toolArgs: { filepath: "a.ts" },
      timestamp: 3,
    });
    const pendingTwo = callbacks.register({
      requestId: "request-4",
      toolName: "editFile",
      toolArgs: { filepath: "b.ts" },
      timestamp: 4,
    });

    expect(callbacks.cancelAll("extension deactivated")).toEqual([
      "request-3",
      "request-4",
    ]);
    await expect(pendingOne).resolves.toMatchObject({
      success: false,
      requestId: "request-3",
      cancelled: true,
    });
    await expect(pendingTwo).resolves.toMatchObject({
      success: false,
      requestId: "request-4",
      cancelled: true,
    });
    expect(callbacks.size).toBe(0);
  });
});
