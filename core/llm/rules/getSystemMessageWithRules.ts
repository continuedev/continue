import { minimatch } from "minimatch";
import { RuleWithSource, ToolResultChatMessage, UserChatMessage } from "../..";
import { renderChatMessage } from "../../util/messageContent";
import { extractPathsFromCodeBlocks } from "../utils/extractPathsFromCodeBlocks";

/**
 * Checks if a path matches any of the provided globs
 */
const matchesGlobs = (
  path: string,
  globs: string | string[] | undefined,
): boolean => {
  if (!globs) return true;

  if (typeof globs === "string") {
    return minimatch(path, globs);
  }

  if (Array.isArray(globs)) {
    return globs.some((glob) => minimatch(path, glob));
  }

  return false;
};

export const getSystemMessageWithRules = ({
  baseSystemMessage,
  userMessage,
  rules,
}: {
  baseSystemMessage?: string;
  userMessage: UserChatMessage | ToolResultChatMessage | undefined;
  rules: RuleWithSource[];
}) => {
  const filePathsFromMessage = userMessage
    ? extractPathsFromCodeBlocks(renderChatMessage(userMessage))
    : [];

  let systemMessage = baseSystemMessage ?? "";

  for (const rule of rules) {
    // A rule is active if it has no globs (applies to all files)
    // or if at least one file path matches its globs
    const hasNoGlobs = !rule.globs;
    const matchesAnyFilePath = filePathsFromMessage.some((path) =>
      matchesGlobs(path, rule.globs),
    );

    if (hasNoGlobs || matchesAnyFilePath) {
      systemMessage += `\n\n${rule.rule}`;
    }
  }

  return systemMessage;
};
