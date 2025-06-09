import { ConfigValidationError } from "@continuedev/config-yaml";
import { IDE, RuleWithSource } from "../..";
import { walkDirs } from "../../indexing/walkDir";
import { convertMarkdownRuleToContinueRule } from "./parseMarkdownRule";

/**
 * Gets the directory part of a path (without using Node.js path module)
 */
const getDirname = (filePath: string): string => {
  // Normalize path separators to forward slash
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Find the last slash
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  // If no slash found, return empty string (current directory)
  if (lastSlashIndex === -1) {
    return "";
  }

  // Return everything up to the last slash
  return normalizedPath.substring(0, lastSlashIndex);
};

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

    // Process each rules.md file
    for (const filePath of rulesMdFiles) {
      try {
        const content = await ide.readFile(filePath);
        const rule = convertMarkdownRuleToContinueRule(filePath, content);

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
