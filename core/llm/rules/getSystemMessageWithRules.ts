import { RuleWithSource, UserChatMessage } from "../..";
import { renderChatMessage } from "../../util/messageContent";
import { extractPathsFromCodeBlocks } from "../utils/extractPathsFromCodeBlocks";
import { isRuleActive } from "./isRuleActive";

export const getSystemMessageWithRules = ({
  baseSystemMessage,
  userMessage,
  rules,
  currentModel,
}: {
  baseSystemMessage?: string;
  userMessage: UserChatMessage | undefined;
  rules: RuleWithSource[];
  currentModel: string;
}) => {
  const filePathsFromMessage = userMessage
    ? extractPathsFromCodeBlocks(renderChatMessage(userMessage))
    : [];

  let systemMessage = baseSystemMessage ?? "";
  for (const rule of rules) {
    if (
      isRuleActive({
        rule,
        activePaths: filePathsFromMessage,
        currentModel,
      })
    ) {
      systemMessage += `\n\n${rule.rule}`;
    }
  }

  return systemMessage;
};
