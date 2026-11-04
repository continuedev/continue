import type { MessageModes, RulesByModeConfig } from "../..";

/**
 * Whether rules are sent in a mode. A mode with no entry is enabled, and
 * background runs follow Agent.
 */
export function rulesEnabledForMode(
  rulesByMode: RulesByModeConfig | undefined,
  mode: MessageModes,
): boolean {
  const key = mode === "background" ? "agent" : mode;
  if (key !== "chat" && key !== "agent" && key !== "plan") return true;
  return rulesByMode?.[key] !== false;
}
