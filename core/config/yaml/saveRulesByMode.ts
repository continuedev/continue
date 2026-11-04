import type { ConfigYaml } from "@continuedev/config-yaml";
import { editConfigFile } from "../../util/paths";

const MODES = ["chat", "agent", "plan"] as const;

/**
 * A mode set to true or false is written as given; `null` removes the entry
 * (back to the default, enabled). Modes not present are left untouched.
 */
export type RulesByModeInput = Partial<
  Record<(typeof MODES)[number], boolean | null>
>;

/** Apply the update to a config.yaml object. Drops `rulesByMode` when empty. */
export function applyRulesByModeUpdate(
  config: ConfigYaml,
  update: RulesByModeInput,
): ConfigYaml {
  const next: Record<string, boolean> = { ...(config.rulesByMode ?? {}) };
  for (const mode of MODES) {
    if (!(mode in update)) continue;
    const value = update[mode];
    if (typeof value === "boolean") next[mode] = value;
    else delete next[mode];
  }
  const result: Record<string, any> = { ...config };
  if (Object.keys(next).length > 0) result.rulesByMode = next;
  else delete result.rulesByMode;
  return result as ConfigYaml;
}

/**
 * Write the update to the global config.yaml, keeping comments and key order.
 * Returns false when there is no config.yaml to edit (a config.json user).
 */
export function saveRulesByMode(update: RulesByModeInput): boolean {
  let edited = false;
  editConfigFile(
    (config) => config,
    (config) => {
      edited = true;
      return applyRulesByModeUpdate(config, update);
    },
  );
  return edited;
}
