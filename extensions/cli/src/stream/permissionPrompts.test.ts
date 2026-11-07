import { describe, expect, it, vi } from "vitest";

import { toolPermissionManager } from "../permissions/permissionManager.js";

import { requestUserPermission } from "./streamChatResponse.helpers.js";

const call = (name: string) =>
  ({
    id: `id-${name}`,
    name,
    arguments: {},
    argumentsStr: "{}",
    startNotified: false,
    tool: {} as any,
  }) as any;

describe("requestUserPermission", () => {
  it("shows one prompt at a time, so a subagent's prompt waits for the parent's", async () => {
    const shown: string[] = [];
    const callbacks = {
      onToolPermissionRequest: vi.fn(
        (toolName: string, _a, requestId: string) =>
          shown.push(`${toolName}:${requestId}`),
      ),
    };

    const parent = requestUserPermission(call("Edit"), callbacks);
    const subagent = requestUserPermission(call("Bash"), callbacks);

    await vi.waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]).toMatch(/^Edit:/);

    toolPermissionManager.approveRequest(shown[0].split(":")[1]);
    expect(await parent).toBe(true);

    await vi.waitFor(() => expect(shown).toHaveLength(2));
    expect(shown[1]).toMatch(/^Bash:/);
    toolPermissionManager.rejectRequest(shown[1].split(":")[1]);
    expect(await subagent).toBe(false);
  });

  it("refuses without a prompt to show", async () => {
    expect(await requestUserPermission(call("Edit"), {})).toBe(false);
  });
});
