import { ToolImpl } from ".";

export const requestRuleImpl: ToolImpl = async (args, extras) => {
  if (!args?.name) {
    throw new Error(
      "`name` argument is required to request a rule, and cannot be empty",
    );
  }

  // Find the rule by name in the config
  const rule = extras.config.rules.find((r) => r.name === args.name);

  if (!rule || !rule.ruleFile) {
    throw new Error(
      `Rule with name "${args.name}" not found or has no file path`,
    );
  }

  return [
    {
      name: rule.name ?? "",
      description: rule.description ?? "",
      content: rule.rule,
      uri: {
        type: "file",
        value: rule.ruleFile,
      },
    },
  ];
};
