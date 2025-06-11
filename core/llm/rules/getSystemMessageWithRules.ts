import { minimatch } from "minimatch";
import {
  ContextItemWithId,
  RuleWithSource,
  ToolResultChatMessage,
  UserChatMessage,
} from "../..";
import { renderChatMessage } from "../../util/messageContent";
import { getCleanUriPath } from "../../util/uri";
import { extractPathsFromCodeBlocks } from "../utils/extractPathsFromCodeBlocks";

/**
 * Checks if a path matches any of the provided globs
 * Supports negative patterns with ! prefix
 */
const matchesGlobs = (
  filePath: string,
  globs: string | string[] | undefined,
): boolean => {
  if (!globs) return true;

  // Handle single string glob
  if (typeof globs === "string") {
    if (globs.startsWith("!")) {
      // Negative pattern - return false if it matches
      return !minimatch(filePath, globs.substring(1));
    }
    return minimatch(filePath, globs);
  }

  // Handle array of globs
  if (Array.isArray(globs)) {
    // Split into positive and negative patterns
    const positivePatterns = globs.filter((g) => !g.startsWith("!"));
    const negativePatterns = globs
      .filter((g) => g.startsWith("!"))
      .map((g) => g.substring(1)); // Remove ! prefix

    // If there are no positive patterns, the file matches unless it matches a negative pattern
    if (positivePatterns.length === 0) {
      return !negativePatterns.some((pattern) => minimatch(filePath, pattern));
    }

    // File must match at least one positive pattern AND not match any negative patterns
    return (
      positivePatterns.some((pattern) => minimatch(filePath, pattern)) &&
      !negativePatterns.some((pattern) => minimatch(filePath, pattern))
    );
  }

  return false;
};

/**
 * Determines if a file path is within a specific directory or its subdirectories
 *
 * @param filePath - The file path to check
 * @param directoryPath - The directory path to check against
 * @returns true if the file is in the directory or subdirectory, false otherwise
 */
const isFileInDirectory = (
  filePath: string,
  directoryPath: string,
): boolean => {
  // Normalize paths for consistent comparison
  let normalizedFilePath = filePath.replace(/\\/g, "/");
  let normalizedDirPath = directoryPath.replace(/\\/g, "/");

  // Strip the file:// protocol if present
  normalizedFilePath = normalizedFilePath.replace(/^file:\/\//, "");
  normalizedDirPath = normalizedDirPath.replace(/^file:\/\//, "");

  // Extract the last parts of the paths for comparison
  // This allows matching relative paths with absolute paths
  // e.g., "nested-folder/file.py" should match "/path/to/nested-folder/"
  const dirPathParts = normalizedDirPath.split("/");

  // Get the directory name (last part of the directory path)
  const dirName = dirPathParts[dirPathParts.length - 1];

  // Check if the file path contains this directory followed by a slash
  // This is a simple check to see if the file might be in this directory
  const containsDir = normalizedFilePath.includes(`${dirName}/`);

  return containsDir;
};

/**
 * Checks if a rule is a root-level rule (.continue directory or no file path)
 */
const isRootLevelRule = (rule: RuleWithSource): boolean => {
  return !rule.ruleFile || rule.ruleFile.startsWith(".continue/");
};

/**
 * Determines if a rule should be considered global and always applied
 * This includes rules with alwaysApply: true OR root-level rules with no globs
 */
const isGlobalRule = (rule: RuleWithSource): boolean => {
  // Rules with alwaysApply: true are always global
  if (rule.alwaysApply === true) {
    return true;
  }

  // Root-level rules with no globs are implicitly global
  if (isRootLevelRule(rule) && !rule.globs && rule.alwaysApply !== false) {
    return true;
  }

  return false;
};

/**
 * Determines if a rule should be applied based on its alwaysApply property and file path matching
 *
 * @param rule - The rule to check
 * @param filePaths - Array of file paths to check against the rule's globs
 * @returns true if the rule should be applied, false otherwise
 */
export const shouldApplyRule = (
  rule: RuleWithSource,
  filePaths: string[],
): boolean => {
  // If it's a global rule, always apply it regardless of file paths
  if (isGlobalRule(rule)) {
    return true;
  }

  // If there are no file paths to check:
  // - We've already handled global rules above
  // - Don't apply other rules since we have no files to match against
  if (filePaths.length === 0) {
    return false;
  }

  // Check if this is a root-level rule (in .continue directory or no file path)
  const isRootRule = isRootLevelRule(rule);

  // For non-root rules, we need to check if any files are in the rule's directory
  if (!isRootRule && rule.ruleFile) {
    const ruleDirectory = getCleanUriPath(rule.ruleFile);
    const lastSlashIndex = ruleDirectory.lastIndexOf("/");
    const ruleDirPath =
      lastSlashIndex !== -1 ? ruleDirectory.substring(0, lastSlashIndex) : "";

    // Filter to only files in this directory or its subdirectories
    const filesInRuleDirectory = filePaths.filter((filePath) =>
      isFileInDirectory(filePath, ruleDirPath),
    );

    // If no files are in this directory, don't apply the rule
    if (filesInRuleDirectory.length === 0) {
      return false;
    }

    // If we have globs, check if any files in this directory match them
    if (rule.globs) {
      return filesInRuleDirectory.some((filePath) =>
        matchesGlobs(filePath, rule.globs),
      );
    }

    // No globs but files are in this directory, so apply the rule
    return true;
  }

  // For root-level rules:

  // If alwaysApply is explicitly false, only apply if there are globs AND they match
  if (rule.alwaysApply === false) {
    if (!rule.globs) {
      return false;
    }
    return filePaths.some((path) => matchesGlobs(path, rule.globs));
  }

  // Default behavior for root rules with globs:
  // - Only apply if they match the globs
  if (rule.globs) {
    return filePaths.some((path) => matchesGlobs(path, rule.globs));
  }

  // This point should not be reached as we've handled all cases above
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
  // First, extract any global rules that should always apply
  const globalRules = rules.filter((rule) => isGlobalRule(rule));

  // Get file paths from message and context for regular rule matching
  const filePathsFromMessage = userMessage
    ? extractPathsFromCodeBlocks(renderChatMessage(userMessage))
    : [];

  // Extract file paths from context items
  const filePathsFromContextItems = contextItems
    .filter((item) => item.uri?.type === "file" && item.uri?.value)
    .map((item) => item.uri!.value);

  // Combine file paths from both sources
  const allFilePaths = [...filePathsFromMessage, ...filePathsFromContextItems];

  // If we have no file paths, just return the global rules
  if (allFilePaths.length === 0) {
    return globalRules;
  }

  // Get rules that match file paths
  const matchingRules = rules
    .filter((rule) => !isGlobalRule(rule)) // Skip global rules as we've already handled them
    .filter((rule) => shouldApplyRule(rule, allFilePaths));

  // Combine global rules with matching rules, ensuring no duplicates
  return [...globalRules, ...matchingRules];
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
