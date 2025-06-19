import { ConfigDependentToolParams, GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface RequestRuleArgs {
  name: string;
}

export function getRequestRuleDescription(
  rules: ConfigDependentToolParams["rules"],
): string {
  // Must be explicitly false and no globs
  const agentRequestedRules = rules.filter(
    (rule) => rule.alwaysApply === false && !rule.globs,
  );

  const prefix =
    "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n";

  const body = agentRequestedRules
    .map((rule) => `${rule.name}: ${rule.description}`)
    .join("\n");

  if (body.length === 0) {
    return prefix + "No rules available.";
  }

  return prefix + body;
}

export const requestRuleTool: GetTool = ({ rules }) => ({
  type: "function",
  displayTitle: "Request Rules",
  wouldLikeTo: "request rule {{{ name }}}",
  isCurrently: "reading rule {{{ name }}}",
  hasAlready: "read rule {{{ name }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  function: {
    name: BuiltInToolNames.RequestRule,
    description: getRequestRuleDescription(rules),
    parameters: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "Name of the rule",
        },
      },
    },
  },
});
