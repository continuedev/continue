import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const createRuleBlock: Tool = {
  type: "function",
  displayTitle: "Create Rule Block",
  wouldLikeTo: 'create a rule block for "{{{ name }}}"',
  isCurrently: 'creating a rule block for "{{{ name }}}"',
  hasAlready: 'created a rule block for "{{{ name }}}"',
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.CreateRuleBlock,
    description:
      "Creates a persistent rule for all future conversations. For establishing code standards or preferences that should be applied consistently. To modify existing rules, use the edit tool instead.",
    parameters: {
      type: "object",
      required: ["name", "rule", "alwaysApply", "description"],
      properties: {
        name: {
          type: "string",
          description:
            "Short, descriptive name summarizing the rule's purpose (e.g. 'React Standards', 'Type Hints')",
        },
        rule: {
          type: "string",
          description:
            "Clear, imperative instruction for future code generation (e.g. 'Use named exports', 'Add Python type hints'). Each rule should focus on one specific standard.",
        },
        description: {
          type: "string",
          description: "Short description of the rule",
        },
        globs: {
          type: "string",
          description:
            "Optional file patterns to which this rule applies (e.g. ['**/*.{ts,tsx}'] or ['src/**/*.ts', 'tests/**/*.ts'])",
        },
        alwaysApply: {
          type: "boolean",
          description:
            "Whether this rule should always be applied regardless of file pattern matching",
        },
      },
    },
  },
};
