import type { PermissionCheckResult } from "./types.js";

/**
 * An MCP tool whose server marks it read-only only fetches context, so asking
 * about it would be noise, in plan mode too. A rule that names the tool wins:
 * this applies only where nothing but the catch-all "*" would have asked.
 */
export function withReadOnlyMcp(
  result: PermissionCheckResult,
  tool: { readonly?: boolean; isBuiltIn?: boolean } | undefined,
): PermissionCheckResult {
  return result.permission === "ask" &&
    tool?.readonly &&
    !tool.isBuiltIn &&
    result.matchedPolicy?.tool === "*"
    ? { ...result, permission: "allow" }
    : result;
}
