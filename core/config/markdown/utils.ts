import {
  RULE_FILE_EXTENSION,
  sanitizeRuleName,
} from "@continuedev/config-yaml";
import { joinPathsToUri } from "../../util/uri";

function createRelativeRuleFilePathParts(ruleName: string): string[] {
  const safeRuleName = sanitizeRuleName(ruleName);
  return [".continue", "rules", `${safeRuleName}.${RULE_FILE_EXTENSION}`];
}

export function createRelativeRuleFilePath(ruleName: string): string {
  return createRelativeRuleFilePathParts(ruleName).join("/");
}

/**
 * Creates the file path for a rule in the workspace .continue/rules directory
 */
export function createRuleFilePath(
  workspaceDir: string,
  ruleName: string,
): string {
  return joinPathsToUri(
    workspaceDir,
    ...createRelativeRuleFilePathParts(ruleName),
  );
}
