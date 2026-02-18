import { minimatch } from "minimatch";
import {
  ContextItemWithId,
  RuleMetadata,
  RuleWithSource,
  ToolResultChatMessage,
  UserChatMessage,
} from "../..";
import { renderChatMessage } from "../../util/messageContent";
import { getCleanUriPath } from "../../util/uri";
import { extractContentFromCodeBlock } from "../utils/extractContentFromCodeBlocks";
import { extractPathsFromCodeBlocks } from "../utils/extractPathsFromCodeBlocks";
import { RulePolicies } from "./types";

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
 * Checks if file content matches any of the provided regex regex
 *
 * @param fileContent - The content of the file to check
 * @param regex - A single regex pattern string or array of regex pattern strings
 * @returns true if the content matches any pattern (or if no regex is provided), false otherwise
 */
const contentMatchesRegex = (
  fileContent: string,
  regex: string | string[],
): boolean => {
  // Handle single string pattern
  if (typeof regex === "string") {
    try {
      const expression = new RegExp(regex);
      return expression.test(fileContent);
    } catch (e) {
      console.error(`Invalid regex pattern: ${regex}`, e);
      return false;
    }
  }

  // Handle array of regex
  if (Array.isArray(regex)) {
    if (regex.length === 0) return true;

    // Content must match at least one pattern
    return regex.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(fileContent);
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`, e);
        return false;
      }
    });
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
  return !rule.sourceFile || rule.sourceFile.includes(".continue/"); // sourceFile path is absolute - hence we need to check for it in between
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

  // Root-level rules with no globs or regex are implicitly global
  if (
    isRootLevelRule(rule) &&
    !rule.globs &&
    !rule.regex &&
    rule.alwaysApply !== false
  ) {
    return true;
  }

  return false;
};

const checkGlobsAndRegex = ({
  rule,
  filePaths,
  fileContents,
}: {
  rule: RuleWithSource;
  filePaths: string[];
  fileContents: Record<string, string>;
}) => {
  const matchingFiles = rule.globs
    ? filePaths.filter((filePath) => matchesGlobs(filePath, rule.globs))
    : filePaths;

  // If no files match the globs, don't apply the rule
  if (matchingFiles.length === 0) {
    return false;
  }

  // Now check for pattern matches in file contents if regex are specified
  if (rule.regex) {
    // Check if any of the matching files also match the content regex
    return matchingFiles.some((filePath) => {
      const content = fileContents[filePath];
      // If we don't have the content, we can't check regex
      if (!content) return false;
      return contentMatchesRegex(content, rule.regex!);
    });
  }

  // If we have no regex or if we couldn't check regex (no content),
  // just go with the glob matches
  return matchingFiles.length > 0;
};

/**
 * Determines if a rule should be applied based on its properties and file matching
 *
 * @param rule - The rule to check
 * @param filePaths - Array of file paths to check against the rule's globs
 * @param fileContents - Map of file paths to their contents for pattern matching
 * @param rulePolicies - Optional policies that can override normal rule behavior
 * @returns true if the rule should be applied, false otherwise
 */
export const shouldApplyRule = (
  rule: RuleWithSource,
  filePaths: string[],
  rulePolicies: RulePolicies = {},
  fileContents: Record<string, string> = {},
): boolean => {
  const policy = rulePolicies[rule.name || ""];

  // Never apply if policy is "off"
  if (policy === "off") {
    return false;
  }

  // If it's a global rule, always apply it regardless of file paths
  if (isGlobalRule(rule)) {
    return true;
  }

  // If there are no file paths to check and we've made it here:
  // - We've already handled global rules above
  // - Don't apply other rules since we have no files to match against
  if (filePaths.length === 0) {
    return false;
  }

  // Check if this is a root-level rule (in .continue directory or no file path)
  const isRootRule = isRootLevelRule(rule);

  // For non-root rules, we need to check if any files are in the rule's directory
  if (!isRootRule && rule.sourceFile) {
    const ruleDirectory = getCleanUriPath(rule.sourceFile);
    const lastSlashIndex = ruleDirectory.lastIndexOf("/");
    const ruleDirPath =
      lastSlashIndex !== -1 ? ruleDirectory.substring(0, lastSlashIndex) : "";

    // Filter to only files in this directory or its subdirectories
    const filesInRuleDirectory = filePaths.filter((filePath) =>
      isFileInDirectory(filePath, ruleDirPath),
    );

    return checkGlobsAndRegex({
      filePaths: filesInRuleDirectory,
      fileContents,
      rule,
    });
  }

  // If alwaysApply is explicitly false, we need to check globs and/or regex
  if (
    rule.alwaysApply === false &&
    rule.globs === undefined &&
    rule.regex === undefined
  ) {
    return false;
  }

  return checkGlobsAndRegex({
    filePaths,
    fileContents,
    rule,
  });
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
  rulePolicies: RulePolicies = {},
): RuleWithSource[] => {
  // Get file paths from message and context for rule matching
  const filePathsFromMessage = userMessage
    ? extractPathsFromCodeBlocks(renderChatMessage(userMessage))
    : [];

  // Extract file paths from context items
  const filePathsFromContextItems = contextItems
    .filter((item) => item.uri?.type === "file" && item.uri?.value)
    .map((item) => item.uri!.value);

  // Combine file paths from both sources
  const allFilePaths = [...filePathsFromMessage, ...filePathsFromContextItems];

  // Create a map of file paths to their contents for pattern matching
  const fileContents: Record<string, string> = {};

  // Extract contents from context items with file URIs
  contextItems.forEach((item) => {
    if (item.uri?.type === "file" && item.uri?.value) {
      fileContents[item.uri.value] = item.content;
    }
  });

  // Extract contents from code blocks in the message for paths that don't have content yet
  if (userMessage) {
    const messageContent = renderChatMessage(userMessage);
    filePathsFromMessage.forEach((path) => {
      // Only extract content if we don't already have it from context items
      if (!fileContents[path]) {
        const blockContent = extractContentFromCodeBlock(messageContent, path);
        if (blockContent) {
          fileContents[path] = blockContent;
        }
      }
    });
  }

  // Apply shouldApplyRule to all rules - this will handle global rules, rule policies,
  // and path matching in a consistent way
  const applicableRules = rules.filter((rule) =>
    shouldApplyRule(rule, allFilePaths, rulePolicies, fileContents),
  );

  return applicableRules;
};

export function getRuleId(rule: RuleMetadata): string {
  return rule.slug ?? rule.sourceFile ?? rule.name ?? rule.source;
}

export const getSystemMessageWithRules = ({
  baseSystemMessage,
  userMessage,
  availableRules,
  contextItems,
  rulePolicies = {},
}: {
  baseSystemMessage?: string;
  userMessage: UserChatMessage | ToolResultChatMessage | undefined;
  availableRules: RuleWithSource[];
  contextItems: ContextItemWithId[];
  rulePolicies?: RulePolicies;
}): {
  systemMessage: string;
  appliedRules: RuleMetadata[];
} => {
  const appliedRules = getApplicableRules(
    userMessage,
    availableRules,
    contextItems,
    rulePolicies,
  );
  let systemMessage = baseSystemMessage ?? "";

  for (const rule of appliedRules) {
    if (systemMessage) {
      systemMessage += "\n\n";
    }
    systemMessage += rule.rule;
  }

  const ruleMetadata = appliedRules.map(({ rule, ...rest }) => rest);

  return {
    systemMessage,
    appliedRules: ruleMetadata,
  };
};
