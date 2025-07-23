import {
  ConfigValidationError,
  markdownToRule,
} from "@continuedev/config-yaml";
import { IDE, RuleWithSource } from "../..";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

/**
 * Loads rules from markdown files in the .continue/rules directory
 */
export async function loadMarkdownRules(ide: IDE): Promise<{
  rules: RuleWithSource[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];

  try {
    // Get all .md files from .continue/rules
    const markdownFiles = await getAllDotContinueDefinitionFiles(
      ide,
      { includeGlobal: true, includeWorkspace: true, fileExtType: "markdown" },
      "rules",
    );

    // Filter to just .md files
    const mdFiles = markdownFiles.filter((file) => file.path.endsWith(".md"));

    // Process each markdown file
    for (const file of mdFiles) {
      try {
        const rule = markdownToRule(file.content, {
          uriType: "file",
          filePath: file.path,
        });
        rules.push({ ...rule, source: "rules-block", ruleFile: file.path });
      } catch (e) {
        errors.push({
          fatal: false,
          message: `Failed to parse markdown rule file ${file.path}: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  } catch (e) {
    errors.push({
      fatal: false,
      message: `Error loading markdown rule files: ${e instanceof Error ? e.message : e}`,
    });
  }

  return { rules, errors };
}
