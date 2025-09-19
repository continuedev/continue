import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const NAME_ARG_DESC =
  "Short, descriptive name summarizing the rule's purpose (e.g. 'React Standards', 'Type Hints')";
const RULE_ARG_DESC =
  "Clear, imperative instruction for future code generation (e.g. 'Use named exports', 'Add Python type hints'). Each rule should focus on one specific standard.";
const DESC_ARG_DESC =
  "Description of when this rule should be applied. Required for Agent Requested rules (AI decides when to apply). Optional for other types.";
const GLOB_ARG_DESC =
  "Optional file patterns to which this rule applies (e.g. ['**/*.{ts,tsx}'] or ['src/**/*.ts', 'tests/**/*.ts'])";
const REGEX_ARG_DESC =
  "Optional regex patterns to match against file content. Rule applies only to files whose content matches the pattern (e.g. 'useEffect' for React hooks or '\\bclass\\b' for class definitions)";

const ALWAYS_APPLY_DESC =
  "Whether this rule should always be applied. Set to false for Agent Requested and Manual rules. Omit or set to true for Always and Auto Attached rules.";

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
      'Creates a "rule" that can be referenced in future conversations. This should be used whenever you want to establish code standards / preferences that should be applied consistently, or when you want to avoid making a mistake again. To modify existing rules, use the edit tool instead.\n\nRule Types:\n- Always: Include only "rule" (always included in model context)\n- Auto Attached: Include "rule", "globs", and/or "regex" (included when files match patterns)\n- Agent Requested: Include "rule" and "description" (AI decides when to apply based on description)\n- Manual: Include only "rule" (only included when explicitly mentioned using @ruleName)',
    parameters: {
      type: "object",
      required: ["name", "rule"],
      properties: {
        name: {
          type: "string",
          description: NAME_ARG_DESC,
        },
        rule: {
          type: "string",
          description: RULE_ARG_DESC,
        },
        description: {
          type: "string",
          description: DESC_ARG_DESC,
        },
        globs: {
          type: "string",
          description: GLOB_ARG_DESC,
        },
        regex: {
          type: "string",
          description: REGEX_ARG_DESC,
        },
        alwaysApply: {
          type: "boolean",
          description: ALWAYS_APPLY_DESC,
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `Sometimes the user will provide feedback or guidance on your output. If you were not aware of these "rules", consider using the ${BuiltInToolNames.CreateRuleBlock} tool to persist the rule for future interactions.
This tool cannot be used to edit existing rules, but you can search in the ".continue/rules" folder and use the edit tool to manage rules.
To create a rule, respond with a ${BuiltInToolNames.CreateRuleBlock} tool call and the following arguments:
- name: ${NAME_ARG_DESC}
- rule: ${RULE_ARG_DESC}
- description: ${DESC_ARG_DESC}
- globs: ${GLOB_ARG_DESC}
- alwaysApply: ${ALWAYS_APPLY_DESC}
For example:`,
    exampleArgs: [
      ["name", "Use PropTypes"],
      [
        "rule",
        "Always use PropTypes when declaring React component properties",
      ],
      [
        "description",
        "Ensure that all prop types are explicitly declared for better type safety and code maintainability in React components.",
      ],
      ["globs", "**/*.js"],
      ["alwaysApply", "false"],
    ],
  },
  toolCallIcon: "PencilIcon",
};
