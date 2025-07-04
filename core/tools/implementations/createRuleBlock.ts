import { createRuleMarkdown } from "@continuedev/config-yaml";
import { ToolImpl } from ".";
import { RuleWithSource } from "../..";
import { createRuleFilePath } from "../../config/markdown/utils";

export type CreateRuleBlockArgs = Pick<
  Required<RuleWithSource>,
  "rule" | "name"
> &
  Pick<RuleWithSource, "globs" | "regex" | "description" | "alwaysApply">;

export const createRuleBlockImpl: ToolImpl = async (
  { name, rule, ...otherArgs }: CreateRuleBlockArgs,
  extras,
) => {
  const fileContent = createRuleMarkdown(name, rule, otherArgs);

  const [localContinueDir] = await extras.ide.getWorkspaceDirs();
  const ruleFilePath = createRuleFilePath(localContinueDir, name);

  await extras.ide.writeFile(ruleFilePath, fileContent);
  await extras.ide.openFile(ruleFilePath);

  return [
    {
      name: "New Rule Block",
      description: otherArgs.description || "",
      uri: {
        type: "file",
        value: ruleFilePath,
      },
      content: `Rule created successfully`,
    },
  ];
};
