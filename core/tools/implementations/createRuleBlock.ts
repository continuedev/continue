import { ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { ToolImpl } from ".";
import { joinPathsToUri } from "../../util/uri";

export interface CreateRuleBlockArgs {
  name: string;
  rule: string;
  globs?: string;
  format?: "yaml" | "markdown"; // Add format option with yaml as default
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

  // Default to YAML format
  const format = args.format ?? "yaml";
  const fileExtension = format === "markdown" ? "md" : "yaml";

  const ruleObject = {
    name: args.name,
    rule: args.rule,
    ...(args.globs ? { globs: args.globs.trim() } : {}),
  };

  let fileContent: string;

  if (format === "markdown") {
    // Generate markdown format with frontmatter
    const frontmatter = {
      ...(args.globs ? { globs: args.globs.trim() } : {}),
    };

    const frontmatterYaml = YAML.stringify(frontmatter).trim();
    fileContent = `---
${frontmatterYaml}
---

# ${args.name}

${args.rule}
`;
  } else {
    // Generate YAML format
    const ruleBlock: ConfigYaml = {
      name: args.name,
      version: "0.0.1",
      schema: "v1",
      rules: [ruleObject],
    };

    fileContent = YAML.stringify(ruleBlock);
  }

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
      description: "", // No description throws an error in the GUI
      uri: {
        type: "file",
        value: rulesDirUri,
      },
      content: `Rule created successfully in ${format} format`,
    },
  ];
};
