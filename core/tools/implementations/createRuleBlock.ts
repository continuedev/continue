import { ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { ToolImpl } from ".";
import { joinPathsToUri } from "../../util/uri";

export interface CreateRuleBlockArgs {
  name: string;
  rule: string;
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

  const ruleObject = {
    name: args.name,
    rule: args.rule,
    ...(args.globs ? { globs: args.globs.trim() } : {}),
  };

  const ruleBlock: ConfigYaml = {
    name: args.name,
    version: "0.0.1",
    schema: "v1",
    rules: [ruleObject],
  };

  const ruleYaml = YAML.stringify(ruleBlock);

  const [localContinueDir] = await extras.ide.getWorkspaceDirs();
  const rulesDirUri = joinPathsToUri(
    localContinueDir,
    ".continue",
    "rules",
    `${safeRuleName}.yaml`,
  );

  await extras.ide.writeFile(rulesDirUri, ruleYaml);
  await extras.ide.openFile(rulesDirUri);

  return [
    {
      name: `New Rule Block`,
      description: "", // No description throws an error in the GUI
      uri: {
        type: "file",
        value: rulesDirUri,
      },
      content: "Rule created successfully",
    },
  ];
};
