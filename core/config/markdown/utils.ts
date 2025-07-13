import {
  RULE_FILE_EXTENSION,
  sanitizeRuleName,
} from "@continuedev/config-yaml";
import { joinPathsToUri } from "../../util/uri";

/**
 * Creates the file path for a rule in the workspace .continue/rules directory
 */
export function createRuleFilePath(
  workspaceDir: string,
  ruleName: string,
): string {
  const safeRuleName = sanitizeRuleName(ruleName);
  return joinPathsToUri(
    workspaceDir,
    ".continue",
    "rules",
    `${safeRuleName}.${RULE_FILE_EXTENSION}`,
  );
}
