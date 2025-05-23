import { minimatch } from "minimatch";
import {
  ContextItemWithId,
  RuleWithSource,
  ToolResultChatMessage,
  UserChatMessage,
} from "../..";
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

/**
 * Filters rules that apply to the given message and/or context items
 *
 * @param userMessage - The user or tool message to check for file paths in code blocks
 * @param rules - The list of rules to filter
 * @param contextItems - Context items to check for file paths
 * @returns List of applicable rules
 */
export const getApplicableRules = (
  userMessage: UserChatMessage | ToolResultChatMessage | undefined,
  rules: RuleWithSource[],
  contextItems: ContextItemWithId[],
): RuleWithSource[] => {
  const filePathsFromMessage = userMessage
    ? extractPathsFromCodeBlocks(renderChatMessage(userMessage))
    : [];

  // Extract file paths from context items
  const filePathsFromContextItems = contextItems
    .filter((item) => item.uri?.type === "file" && item.uri?.value)
    .map((item) => item.uri!.value);
  // Combine file paths from both sources
  const allFilePaths = [...filePathsFromMessage, ...filePathsFromContextItems];

  return rules.filter((rule) => {
    // A rule is active if it has no globs (applies to all files)
    // or if at least one file path matches its globs
    const hasNoGlobs = !rule.globs;
    const matchesAnyFilePath = allFilePaths.some((path) =>
      matchesGlobs(path, rule.globs),
    );

    return hasNoGlobs || matchesAnyFilePath;
  });
};

/**
 * Creates a system message string with applicable rules appended
 *
 * @param baseSystemMessage - The base system message to start with
 * @param userMessage - The user message to check for file paths
 * @param rules - The list of rules to filter
 * @param contextItems - Context items to check for file paths
 * @returns System message with applicable rules appended
 */
export const getSystemMessageWithRules = ({
  baseSystemMessage,
  userMessage,
  rules,
  contextItems,
}: {
  baseSystemMessage?: string;
  userMessage: UserChatMessage | ToolResultChatMessage | undefined;
  rules: RuleWithSource[];
  contextItems: ContextItemWithId[];
}) => {
  const applicableRules = getApplicableRules(userMessage, rules, contextItems);
  let systemMessage = baseSystemMessage ?? "";

  for (const rule of applicableRules) {
    systemMessage += `\n\n${rule.rule}`;
  }

  return systemMessage;
};
