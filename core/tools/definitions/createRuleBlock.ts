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
      'Creates a "rule" that can be referenced in future conversations. This should be used whenever you want to establish code standards / preferences that should be applied consistently, or when you want to avoid making a mistake again. To modify existing rules, use the edit tool instead.',
    parameters: {
      type: "object",
      required: ["name", "rule", "description"],
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
        regex: {
          type: "string",
          description:
            "Optional regex patterns to match against file content. Rule applies only to files whose content matches the pattern (e.g. 'useEffect' for React hooks or '\\bclass\\b' for class definitions)",
        },
      },
    },
  },
};
