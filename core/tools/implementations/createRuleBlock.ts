import { ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { ToolImpl } from ".";
import { joinPathsToUri } from "../../util/uri";

export interface CreateRuleBlockArgs {
  rule_name: string;
  rule_content: string;
}

export const createRuleBlockImpl: ToolImpl = async (
  args: CreateRuleBlockArgs,
  extras,
) => {
  // Sanitize rule name for use in filename (remove special chars, replace spaces with dashes)
  const safeRuleName = args.rule_name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

  const ruleBlock: ConfigYaml = {
    name: args.rule_name,
    version: "0.0.1",
    rules: [
      // This can be either a string or an object with {name, rule}
      // Since we want a simple rule, we use the string format
      args.rule_content,
    ],
  };

  // Convert the rule block to YAML
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
      name: "Rule Block Created",
      description: `Created ${args.rule_name} rule`,
      content: ruleYaml,
    },
  ];
};
