import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const createRuleBlock: Tool = {
  type: "function",
  displayTitle: "Create Rule Block",
  wouldLikeTo: 'create a rule block for "{{{ rule_name }}}"',
  isCurrently: 'creating a rule block for "{{{ rule_name }}}"',
  hasAlready: 'created a rule block for "{{{ rule_name }}}"',
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.CreateRuleBlock,
    description:
      "Creates a persistent rule that applies to all future conversations. " +
      "Use for establishing ongoing code standards or preferences (e.g. 'use named exports', 'follow Google docstrings'). " +
      "Not for one-time instructions. Rules are stored as YAML in `.continue/rules`.",
    parameters: {
      type: "object",
      required: ["rule_name", "rule_content"],
      properties: {
        rule_name: {
          type: "string",
          description:
            "Short, descriptive name summarizing the rule's purpose (e.g. 'React Standards', 'Type Hints')",
        },
        rule_content: {
          type: "string",
          description:
            "Clear, imperative instruction for future code generation (e.g. 'Use named exports', 'Add Python type hints'). Each rule should focus on one specific standard.",
        },
      },
    },
  },
};
