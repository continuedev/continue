import { createRuleMarkdown } from "@continuedev/config-yaml";
import { ToolImpl } from ".";
import { RuleWithSource } from "../..";
import { createRuleFilePath } from "../../config/markdown/utils";

export type CreateRuleBlockArgs = Pick<
  Required<RuleWithSource>,
  "rule" | "description" | "alwaysApply" | "name"
> &
  Pick<RuleWithSource, "globs">;

export const createRuleBlockImpl: ToolImpl = async (
  args: CreateRuleBlockArgs,
  extras,
) => {
  const fileContent = createRuleMarkdown(args.name, args.rule, {
    description: args.description,
    globs: args.globs,
  });

  const [localContinueDir] = await extras.ide.getWorkspaceDirs();
  const ruleFilePath = createRuleFilePath(localContinueDir, args.name);

  await extras.ide.writeFile(ruleFilePath, fileContent);
  await extras.ide.openFile(ruleFilePath);

  return [
    {
      name: "New Rule Block",
      description: args.description || "",
      uri: {
        type: "file",
        value: ruleFilePath,
      },
      content: `Rule created successfully`,
    },
  ];
};
