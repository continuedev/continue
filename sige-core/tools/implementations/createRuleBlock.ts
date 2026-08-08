import { createRuleMarkdown } from "@continuedev/config-yaml";
import { ToolImpl } from ".";
import { RuleWithSource } from "../..";
import { createRuleFilePath } from "../../config/markdown/utils";
import {
  getBooleanArg,
  getOptionalStringArg,
  getStringArg,
} from "../parseArgs";

export type CreateRuleBlockArgs = Pick<
  Required<RuleWithSource>,
  "rule" | "name"
> &
  Pick<RuleWithSource, "globs" | "regex" | "description" | "alwaysApply">;

export const createRuleBlockImpl: ToolImpl = async (args, extras) => {
  const name = getStringArg(args, "name");
  const rule = getStringArg(args, "rule");

  const description = getOptionalStringArg(args, "description");
  const regex = getOptionalStringArg(args, "regex");
  const globs = getOptionalStringArg(args, "globs");
  const alwaysApply = getBooleanArg(args, "alwaysApply", false);

  const fileContent = createRuleMarkdown(name, rule, {
    alwaysApply,
    description,
    globs,
    regex,
  });

  const [localContinueDir] = await extras.ide.getWorkspaceDirs();
  const ruleFilePath = createRuleFilePath(localContinueDir, name);

  await extras.ide.writeFile(ruleFilePath, fileContent);
  await extras.ide.openFile(ruleFilePath);

  return [
    {
      name: "New Rule Block",
      description: description || "",
      uri: {
        type: "file",
        value: ruleFilePath,
      },
      content: `Rule created successfully`,
    },
  ];
};
