import * as YAML from "yaml";
import { ToolImpl } from ".";
import { RuleWithSource } from "../..";
import { RuleFrontmatter } from "../../config/markdown/parseMarkdownRule";
import { joinPathsToUri } from "../../util/uri";

export type CreateRuleBlockArgs = Pick<
  Required<RuleWithSource>,
  "rule" | "description" | "alwaysApply" | "name"
> &
  Pick<RuleWithSource, "globs">;

export const createRuleBlockImpl: ToolImpl = async (
  args: CreateRuleBlockArgs,
  extras,
) => {
  // Sanitize rule name for use in filename (remove special chars, replace spaces with dashes)
  const safeRuleName = args.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

  const fileExtension = "md";

  const frontmatter: RuleFrontmatter = {};

  if (args.globs) {
    frontmatter.globs =
      typeof args.globs === "string" ? args.globs.trim() : args.globs;
  }

  if (args.description) {
    frontmatter.description = args.description.trim();
  }

  if (args.alwaysApply !== undefined) {
    frontmatter.alwaysApply = args.alwaysApply;
  }

  const frontmatterYaml = YAML.stringify(frontmatter).trim();
  let fileContent = `---
${frontmatterYaml}
---

# ${args.name}

${args.rule}
`;
  const [localContinueDir] = await extras.ide.getWorkspaceDirs();
  const rulesDirUri = joinPathsToUri(
    localContinueDir,
    ".continue",
    "rules",
    `${safeRuleName}.${fileExtension}`,
  );

  await extras.ide.writeFile(rulesDirUri, fileContent);
  await extras.ide.openFile(rulesDirUri);

  return [
    {
      name: "New Rule Block",
      description: args.description || "",
      uri: {
        type: "file",
        value: rulesDirUri,
      },
      content: `Rule created successfully`,
    },
  ];
};
