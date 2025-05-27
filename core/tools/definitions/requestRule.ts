import { ConfigDependentToolParams, GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface RequestRuleArgs {
  filepath: string;
  name: string;
}

export function getRequestRuleDescription(
  rules: ConfigDependentToolParams["rules"],
): string {
  // Must be explicitly false
  const agentRequestedRules = rules.filter(
    (rule) => rule.alwaysApply === false,
  );

  const prefix =
    "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n";

  const body = agentRequestedRules
    .map(
      (rule) =>
        `Rule: ${rule.name}\nDescription: ${rule.description}\nFilepath: ${rule.ruleFile}`,
    )
    .join("\n\n");

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
      required: ["name", "filepath"],
      properties: {
        filepath: {
          type: "string",
          description: "The path of the rule file",
        },
        name: {
          type: "string",
          description: "Name of the rule",
        },
      },
    },
  },
});
