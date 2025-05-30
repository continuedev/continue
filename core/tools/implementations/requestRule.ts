import { ToolImpl } from ".";
import { parseMarkdownRule } from "../../config/markdown/parseMarkdownRule";

export const requestRuleImpl: ToolImpl = async (args, extras) => {
  // Find the rule by name in the config
  const rule = extras.config.rules.find((r) => r.name === args.name);

  if (!rule || !rule.ruleFile) {
    throw new Error(
      `Rule with name "${args.name}" not found or has no file path`,
    );
  }

  const fileContent = await extras.ide.readFile(rule.ruleFile);
  const { markdown, frontmatter } = parseMarkdownRule(fileContent);

  return [
    {
      name: frontmatter.name ?? "",
      description: frontmatter.description ?? "",
      content: markdown,
      uri: {
        type: "file",
        value: rule.ruleFile,
      },
    },
  ];
};
