import type { Session } from "../..";

export interface VSCodeBridgePermissionRequest {
  toolName: string;
  toolArgs: unknown;
  requestId: string;
  timestamp: number;
  toolCallPreview?: unknown[];
}

export interface VSCodeBridgePermissionResponse {
  requestId: string;
  approved: boolean;
}

export interface VSCodeBridgePermissionResult {
  success: true;
  approved: boolean;
}

export interface VSCodeBridgeDialogOption {
  title: string;
  value: string;
  detail?: string;
}

export interface VSCodeBridgeDialogRequest {
  id: string;
  kind: "info" | "warning" | "error" | "input" | "pick";
  title: string;
  message?: string;
  placeholder?: string;
  options?: VSCodeBridgeDialogOption[];
  allowMultiple?: boolean;
}

export interface VSCodeBridgeDialogResponse {
  id: string;
  confirmed: boolean;
  value?: string | string[];
}

export interface VSCodeBridgeStateSnapshot {
  session: Session;
  isProcessing: boolean;
  messageQueueLength: number;
  pendingPermission: VSCodeBridgePermissionRequest | null;
}

export function isVSCodeBridgePermissionResponse(
  value: unknown,
): value is VSCodeBridgePermissionResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.requestId === "string" &&
    typeof candidate.approved === "boolean"
  );
}
