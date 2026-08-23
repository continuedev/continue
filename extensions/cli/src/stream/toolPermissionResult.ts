export type ToolPermissionDenialReason = "user" | "policy" | "callback_missing";

export interface ToolPermissionApprovalResult {
  approved: boolean;
  denialReason?: ToolPermissionDenialReason;
}

export function resolveUserPermissionResult(
  userApproved: boolean | undefined,
): ToolPermissionApprovalResult {
  if (userApproved === undefined) {
    return { approved: false, denialReason: "callback_missing" };
  }
  return userApproved
    ? { approved: true }
    : { approved: false, denialReason: "user" };
}

export function getPermissionDeniedMessage(
  reason: ToolPermissionDenialReason,
): string {
  if (reason === "policy") {
    return "Command blocked by security policy";
  }
  if (reason === "callback_missing") {
    return "Interactive permission prompt unavailable";
  }
  return "Permission denied by user";
}
