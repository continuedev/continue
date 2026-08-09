import { RuleWithSource, SlashCommandWithSource } from "../..";

export function convertRuleBlockToSlashCommand(
  rule: RuleWithSource,
): SlashCommandWithSource {
  return {
    name:
      rule.name ||
      (rule.rule.length > 20 ? rule.rule.substring(0, 20) + "..." : rule.rule),
    description: rule.description ?? "",
    prompt: rule.rule,
    source: "invokable-rule",
    sourceFile: rule.sourceFile,
    slug: rule.slug,
  };
}
