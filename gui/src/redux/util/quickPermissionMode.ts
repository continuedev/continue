import { ToolPolicy } from "@yutoagentic/terminal-security";
import { Tool } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { QuickPermissionMode } from "../slices/uiSlice";

export function applyQuickPermissionModeToToolPolicy(
  basePolicy: ToolPolicy,
  tool: Tool | undefined,
  quickPermissionMode: QuickPermissionMode,
): ToolPolicy {
  if (quickPermissionMode === "default") {
    return basePolicy;
  }

  // Never bypass a policy that is explicitly disabled.
  if (basePolicy === "disabled") {
    return "disabled";
  }

  if (quickPermissionMode === "bypass") {
    return "allowedWithoutPermission";
  }

  if (!tool) {
    return "disabled";
  }

  // Restrictive mode: keep readonly/codebase access but gate everything else.
  if (!tool.readonly && tool.function.name !== BuiltInToolNames.CodebaseTool) {
    return "disabled";
  }

  return "allowedWithPermission";
}
