import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../instructionTools/buildXmlToolsSystemMessage";

const NAME_ARG_DESC =
  "Short, descriptive name summarizing the rule's purpose (e.g. 'React Standards', 'Type Hints')";
const RULE_ARG_DESC =
  "Clear, imperative instruction for future code generation (e.g. 'Use named exports', 'Add Python type hints'). Each rule should focus on one specific standard.";
const DESC_ARG_DESC = "Short description of the rule";
const GLOB_ARG_DESC =
  "Optional file patterns to which this rule applies (e.g. ['**/*.{ts,tsx}'] or ['src/**/*.ts', 'tests/**/*.ts'])";

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
        alwaysApply: {
          type: "boolean",
          description:
            "Whether this rule should always be applied regardless of file pattern matching",
        },
      },
    },
  },
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.CreateRuleBlock,
    `Sometimes the user will provide feedback or guidance on your output. If you were not aware of these "rules", consider using the ${BuiltInToolNames.CreateRuleBlock} tool to persist the rule for future interactions.
This tool cannot be used to edit existing rules, but you can search in the ".continue/rules" folder and use the edit tool to manage rules.
To create a rule, respond with a ${BuiltInToolNames.CreateRuleBlock} tool call and the following arguments:
- name: ${NAME_ARG_DESC}
- rule: ${RULE_ARG_DESC}
- description: ${DESC_ARG_DESC}
- globs: ${GLOB_ARG_DESC}
For example:`,
    `<name>Use PropTypes</name>
<rule>Always use PropTypes when declaring React component properties</rule>
<description>Ensure that all prop types are explicitly declared for better type safety and code maintainability in React components.</description>
<globs>**/*.js</globs>`,
  ),
};
