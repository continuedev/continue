import * as YAML from "yaml";
import { ToolImpl } from ".";
import { joinPathsToUri } from "../../util/uri";

export interface CreateRuleBlockArgs {
  name: string;
  rule: string;
  description: string;
  globs?: string;
}

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

  const frontmatter: Record<string, string> = {};

  if (args.globs) {
    frontmatter.globs = args.globs.trim();
  }

  if (args.description) {
    frontmatter.description = args.description.trim();
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
