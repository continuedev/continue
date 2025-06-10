import { ConfigValidationError } from "@continuedev/config-yaml";
import type { RuleSource } from "..";
import { IDE, RuleWithSource } from "..";
import { getRulesDotFile } from "../granite/config/graniteDotFiles";
import { joinPathsToUri } from "../util/uri";
export const SYSTEM_PROMPT_DOT_FILE = ".continuerules";

export async function getWorkspaceContinueRuleDotFiles(ide: IDE) {
  const dirs = await ide.getWorkspaceDirs();

  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];
  for (const dir of dirs) {
    try {
      const rulesFileName = await getRulesDotFile(ide, dir);
      const dotFile = joinPathsToUri(dir, rulesFileName);
      const exists = await ide.fileExists(dotFile);
      if (exists) {
        const content = await ide.readFile(dotFile);
        rules.push({
          rule: content,
          ruleFile: dotFile,
          source: rulesFileName as RuleSource,
        });
      }
    } catch (e) {
      errors.push({
        fatal: false,
        message: `Failed to load system prompt dot file from workspace ${dir}: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  return { rules, errors };
}
