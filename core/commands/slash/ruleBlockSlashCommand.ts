import { RuleWithSource, SlashCommandWithSource } from "../..";

export function convertRuleBlockToSlashCommand(
  rule: RuleWithSource,
): SlashCommandWithSource {
  return {
    name: rule.name || "Unnamed Rule",
    description: rule.description ?? "",
    prompt: rule.rule,
    source: "invokable-rule",
    promptFile: rule.ruleFile,
  };
}
