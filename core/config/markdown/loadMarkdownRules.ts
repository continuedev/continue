import {
  ConfigValidationError,
  markdownToRule,
} from "@continuedev/config-yaml";
import { IDE, RuleWithSource } from "../..";
import { PROMPTS_DIR_NAME, RULES_DIR_NAME } from "../../promptFiles";
import { joinPathsToUri } from "../../util/uri";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

export const SUPPORTED_AGENT_FILES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"];
/**
 * Loads rules from markdown files in the .continue/rules and .continue/prompts directories
 * and agent files (AGENTS.md, AGENT.md, CLAUDE.md) at workspace root
 */
export async function loadMarkdownRules(ide: IDE): Promise<{
  rules: RuleWithSource[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];

  // First, try to load agent files from workspace root
  const workspaceDirs = await ide.getWorkspaceDirs();

  for (const workspaceDir of workspaceDirs) {
    let agentFileFound = false;
    for (const fileName of SUPPORTED_AGENT_FILES) {
      try {
        const agentFileUri = joinPathsToUri(workspaceDir, fileName);
        const exists = await ide.fileExists(agentFileUri);
        if (exists) {
          const agentContent = await ide.readFile(agentFileUri);

          const rule = markdownToRule(agentContent, {
            uriType: "file",
            fileUri: agentFileUri,
          });
          rules.push({
            ...rule,
            source: "agentFile",
            sourceFile: agentFileUri,
            alwaysApply: true,
          });
          agentFileFound = true;
        }

        break; // Use the first found agent file in this workspace
      } catch (e) {
        // File doesn't exist or can't be read, continue to next file
      }
    }
    if (agentFileFound) {
      break; // Use agent file from first workspace that has one
    }
  }

  // Load markdown files from both .continue/rules and .continue/prompts
  const dirsToCheck = [RULES_DIR_NAME, PROMPTS_DIR_NAME];

  for (const dirName of dirsToCheck) {
    try {
      const markdownFiles = await getAllDotContinueDefinitionFiles(
        ide,
        {
          includeGlobal: true,
          includeWorkspace: true,
          fileExtType: "markdown",
        },
        dirName,
      );

      // Filter to just .md files
      const mdFiles = markdownFiles.filter((file) => file.path.endsWith(".md"));

      // Process each markdown file
      for (const file of mdFiles) {
        try {
          const rule = markdownToRule(file.content, {
            uriType: "file",
            fileUri: file.path,
          });
          if (!rule.invokable) {
            rules.push({
              ...rule,
              source: "rules-block",
              sourceFile: file.path,
            });
          }
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
        message: `Error loading markdown rule files from ${dirName}: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  return { rules, errors };
}
