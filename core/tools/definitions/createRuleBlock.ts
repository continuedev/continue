import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const createRuleBlock: Tool = {
  type: "function",
  displayTitle: "Create Rule Block",
  wouldLikeTo: 'create a rule block for "{{{ rule_name }}}"',
  isCurrently: 'creating a rule block for "{{{ rule_name }}}"',
  hasAlready: 'created a rule block for "{{{ rule_name }}}"',
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.CreateRuleBlock,
    description:
      "Creates a persistent rule block that will be applied to all future Chat, Edit and Agent conversations. " +
      "Use this tool when the user wants to establish ongoing behaviors, preferences, or standards for code generation. " +
      "This is ideal for capturing recurring preferences like 'always use named exports instead of default exports' or 'follow Google style docstrings'. " +
      "Do NOT use this tool for one-time instructions that should only apply to the current conversation. " +
      "The created rule will be formatted as a YAML file and stored in the user's `.continue/rules` directory.",
    parameters: {
      type: "object",
      required: ["rule_name", "rule_content"],
      properties: {
        rule_name: {
          type: "string",
          description:
            "A clear, descriptive name for the rule block that summarizes its purpose. This name will be visible in the Continue UI and should help users identify the rule's function. For example: 'React Component Standards', 'Python Type Hints', or 'Code Documentation Requirements'.",
        },
        rule_content: {
          type: "string",
          description:
            "The specific instruction or standard to be followed in all future conversations. This should be a clear, concise directive written in imperative form. For example: 'Always use named exports instead of default exports in JavaScript modules', 'Always annotate Python functions with parameter and return types', or 'Use camelCase for variable names in JavaScript'. Each rule should focus on a single, well-defined behavior or standard.",
        },
      },
    },
  },
};
