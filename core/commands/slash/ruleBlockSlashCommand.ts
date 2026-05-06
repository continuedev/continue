import { RuleWithSource, SlashCommandWithSource } from "../..";
import { truncateToWidth } from "../../util/truncate.js";

export function convertRuleBlockToSlashCommand(
  rule: RuleWithSource,
): SlashCommandWithSource {
  return {
    name: rule.name || truncateToWidth(rule.rule, 20),
    description: rule.description ?? "",
    prompt: rule.rule,
    source: "invokable-rule",
    sourceFile: rule.sourceFile,
    slug: rule.slug,
  };
}
