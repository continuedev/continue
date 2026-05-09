import type { VSCodeBridgePermissionRequest } from "core/agent/contracts/index.js";
import { convertToUnifiedHistory } from "core/util/messageConversion.js";
import { describe, expect, it } from "vitest";

import { getCompleteStateSnapshot } from "../session.js";

import { parsePermissionResponseBody } from "./serve.js";

describe("serve bridge contracts", () => {
  it("parses a valid permission response body", () => {
    const parsed = parsePermissionResponseBody({
      requestId: "tool-request-1",
      approved: true,
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        requestId: "tool-request-1",
        approved: true,
      },
    });
  });

  it("rejects malformed permission response bodies", () => {
    expect(parsePermissionResponseBody(undefined)).toEqual({
      ok: false,
      error:
        "Request body must include string requestId and either boolean approved or an optional cancellation reason",
    });

    expect(
      parsePermissionResponseBody({ requestId: 12, approved: "yes" }),
    ).toEqual({
      ok: false,
      error:
        "Request body must include string requestId and either boolean approved or an optional cancellation reason",
    });
  });

  it("parses a cancellation permission response body", () => {
    const parsed = parsePermissionResponseBody({
      requestId: "tool-request-2",
      reason: "dismissed",
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        requestId: "tool-request-2",
        cancelled: true,
        reason: "dismissed",
      },
    });
  });

  it("preserves the typed pending permission in the state snapshot", () => {
    const session = {
      id: "session-1",
      workspaceDirectory: "/workspace",
      history: convertToUnifiedHistory([
        { role: "system", content: "System" },
        { role: "user", content: "Prompt" },
      ]),
    } as any;

    const pendingPermission: VSCodeBridgePermissionRequest = {
      toolName: "Read",
      toolArgs: { filePath: "src/index.ts" },
      requestId: "tool-request-1",
      timestamp: 123,
      toolCallPreview: [{ kind: "file", value: "src/index.ts" }],
    };

    const snapshot = getCompleteStateSnapshot(
      session,
      true,
      2,
      pendingPermission,
    );

    expect(snapshot.pendingPermission).toEqual(pendingPermission);
    expect(snapshot.isProcessing).toBe(true);
    expect(snapshot.messageQueueLength).toBe(2);
  });
});
