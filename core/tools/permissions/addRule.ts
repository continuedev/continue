import type { ConfigYaml } from "@continuedev/config-yaml";
import { editConfigFile } from "../../util/paths";
import { parseRule, RuleDecision } from "./rules";

export type AddToolRuleResult = "added" | "exists" | "no-config" | "invalid";

/**
 * Add one rule to `toolPermissions.<decision>`, once. Other lists, other rules
 * and the order of the existing ones are left alone.
 */
export function applyAddToolRule(
  config: ConfigYaml,
  decision: RuleDecision,
  rule: string,
): ConfigYaml {
  const current = config.toolPermissions ?? {};
  const list = current[decision] ?? [];
  if (list.includes(rule)) return config;
  return {
    ...config,
    toolPermissions: { ...current, [decision]: [...list, rule] },
  };
}

/**
 * Write a rule to the global config.yaml (comments kept). A rule that does not
 * parse is refused, because it would be skipped on load and protect or allow
 * nothing while looking like it did.
 */
export function addToolRule(
  decision: RuleDecision,
  rule: string,
): AddToolRuleResult {
  const trimmed = rule.trim();
  if (!parseRule(trimmed, decision)) return "invalid";

  let ran = false;
  let changed = false;
  editConfigFile(
    (config) => config, // config.json has no toolPermissions
    (config) => {
      ran = true;
      const next = applyAddToolRule(config, decision, trimmed);
      changed = next !== config;
      return next;
    },
  );
  if (!ran) return "no-config";
  return changed ? "added" : "exists";
}
