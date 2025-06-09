import { ConfigValidationError } from "@continuedev/config-yaml";
import path from "path";
import { IDE, RuleWithSource } from "../..";
import { walkDirs } from "../../indexing/walkDir";
import { convertMarkdownRuleToContinueRule } from "./parseMarkdownRule";

/**
 * Loads rules from rules.md files colocated in the codebase
 */
export async function loadCodebaseRules(ide: IDE): Promise<{
  rules: RuleWithSource[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];

  try {
    // Get all files from the workspace
    const allFiles = await walkDirs(ide);

    // Filter to just rules.md files
    const rulesMdFiles = allFiles.filter((file) => {
      const parts = file.split("/");
      const filename = parts[parts.length - 1];
      return filename === "rules.md";
    });

    console.log(`Found ${rulesMdFiles.length} rules.md files in the workspace`);

    // Process each rules.md file
    for (const filePath of rulesMdFiles) {
      try {
        const content = await ide.readFile(filePath);
        const rule = convertMarkdownRuleToContinueRule(filePath, content);

        // If the rule doesn't have globs specified, we'll log that fact for debugging
        if (!rule.globs) {
          console.log(
            `Rule in ${filePath} doesn't have explicit globs - it will be applied based on directory location: ${path.dirname(filePath)}`,
          );
        } else {
          console.log(
            `Rule in ${filePath} has explicit globs: ${typeof rule.globs === "string" ? rule.globs : JSON.stringify(rule.globs)}`,
          );
        }

        rules.push(rule);
      } catch (e) {
        errors.push({
          fatal: false,
          message: `Failed to parse colocated rule file ${filePath}: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  } catch (e) {
    errors.push({
      fatal: false,
      message: `Error loading colocated rule files: ${e instanceof Error ? e.message : e}`,
    });
  }

  return { rules, errors };
}
