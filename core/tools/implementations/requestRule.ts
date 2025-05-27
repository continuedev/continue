import { ToolImpl } from ".";
import { parseMarkdownRule } from "../../config/markdown/parseMarkdownRule";

export const requestRuleImpl: ToolImpl = async (args, extras) => {
  const fileContent = await extras.ide.readFile(args.filepath);
  const { markdown, frontmatter } = parseMarkdownRule(fileContent);

  return [
    {
      name: frontmatter.name ?? "",
      description: frontmatter.description ?? "",
      content: markdown,
      uri: {
        type: "file",
        value: args.filepath,
      },
    },
  ];
};
