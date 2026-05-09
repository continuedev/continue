import type {
  VSCodeBridgeDialogRequest,
  VSCodeBridgePermissionCancellation,
  VSCodeBridgePermissionRequest,
  VSCodeBridgePermissionResponse,
  VSCodeBridgePermissionResult,
} from "core/agent/contracts/index.js";
import type { ControlPlaneClient } from "core/control-plane/client";

import type { DialogLaunchers } from "../ui/dialogLaunchers";

import { PermissionCallbacks } from "./PermissionCallbacks";

function formatPermissionMessage(
  request: VSCodeBridgePermissionRequest,
): string {
  const argPreview =
    request.toolArgs === undefined
      ? ""
      : `\n\nArguments:\n${JSON.stringify(request.toolArgs, null, 2)}`;

  return `Allow background agent tool call: ${request.toolName}?${argPreview}`;
}

function buildPermissionDialogRequest(
  request: VSCodeBridgePermissionRequest,
): VSCodeBridgeDialogRequest {
  return {
    id: request.requestId,
    kind: "warning",
    title: `Permission required: ${request.toolName}`,
    message: formatPermissionMessage(request),
    options: [
      { title: "Allow", value: "approve" },
      { title: "Deny", value: "deny" },
    ],
  };
}

export async function resolvePendingAgentPermission(params: {
  agentSessionId: string;
  request: VSCodeBridgePermissionRequest;
  controlPlaneClient: Pick<ControlPlaneClient, "respondToAgentPermission">;
  permissionCallbacks: PermissionCallbacks;
  dialogLaunchers: Pick<DialogLaunchers, "showBridgeDialog">;
}): Promise<VSCodeBridgePermissionResult> {
  const {
    agentSessionId,
    request,
    controlPlaneClient,
    permissionCallbacks,
    dialogLaunchers,
  } = params;

  const pendingResult = permissionCallbacks.register(request);

  try {
    const dialogResponse = await dialogLaunchers.showBridgeDialog(
      buildPermissionDialogRequest(request),
    );

    if (!dialogResponse.confirmed) {
      permissionCallbacks.cancel({
        requestId: request.requestId,
        reason: "dismissed",
      });
    } else {
      const approved = dialogResponse.value === "approve";
      permissionCallbacks.resolve({
        requestId: request.requestId,
        approved,
      });
    }
  } catch (error) {
    permissionCallbacks.cancel({
      requestId: request.requestId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const result = await pendingResult;
  const responsePayload:
    | VSCodeBridgePermissionResponse
    | VSCodeBridgePermissionCancellation = result.success
    ? {
        requestId: result.requestId,
        approved: result.approved,
      }
    : {
        requestId: result.requestId,
        reason: result.reason,
      };

  return (
    (await controlPlaneClient.respondToAgentPermission(
      agentSessionId,
      responsePayload,
    )) ?? result
  );
}
