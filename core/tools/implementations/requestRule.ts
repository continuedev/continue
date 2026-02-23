import { ToolImpl } from ".";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const requestRuleImpl: ToolImpl = async (args, extras) => {
  const name = getStringArg(args, "name");

  // Find the rule by name in the config
  const rule = extras.config.rules.find((r) => r.name === name);

  if (!rule || !rule.sourceFile) {
    throw new ContinueError(
      ContinueErrorReason.RuleNotFound,
      `Rule with name "${name}" not found or has no file path`,
    );
  }

  return [
    {
      name: rule.name ?? "",
      description: rule.description ?? "",
      content: rule.rule,
      uri: {
        type: "file",
        value: rule.sourceFile,
      },
    },
  ];
};
