import {
  ConfigValidationError,
  markdownToRule,
} from "@continuedev/config-yaml";
import { IDE, RuleWithSource } from "../..";
import { walkDirs } from "../../indexing/walkDir";
import { RULES_MARKDOWN_FILENAME } from "../../llm/rules/constants";
import { findUriInDirs, getUriPathBasename } from "../../util/uri";

export class CodebaseRulesCache {
  private static instance: CodebaseRulesCache | null = null;
  private constructor() {}

  public static getInstance(): CodebaseRulesCache {
    if (CodebaseRulesCache.instance === null) {
      CodebaseRulesCache.instance = new CodebaseRulesCache();
    }
    return CodebaseRulesCache.instance;
  }
  rules: RuleWithSource[] = [];
  errors: ConfigValidationError[] = [];
  async refresh(ide: IDE) {
    const { rules, errors } = await loadCodebaseRules(ide);
    this.rules = rules;
    this.errors = errors;
  }
  async update(ide: IDE, uri: string) {
    const content = await ide.readFile(uri);
    const workspaceDirs = await ide.getWorkspaceDirs();
    const { relativePathOrBasename, foundInDir } = findUriInDirs(
      uri,
      workspaceDirs,
    );
    if (!foundInDir) {
      console.warn(
        `Failed to load codebase rule ${uri}: URI not found in workspace`,
      );
    }
    const rule = markdownToRule(
      content,
      {
        uriType: "file",
        fileUri: uri,
      },
      relativePathOrBasename,
    );
    const ruleWithSource: RuleWithSource = {
      ...rule,
      source: "colocated-markdown",
      sourceFile: uri,
    };
    const matchIdx = this.rules.findIndex((r) => r.sourceFile === uri);
    if (matchIdx === -1) {
      this.rules.push(ruleWithSource);
    } else {
      this.rules[matchIdx] = ruleWithSource;
    }
  }
  remove(uri: string) {
    this.rules = this.rules.filter((r) => r.sourceFile !== uri);
  }
}

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
      const filename = getUriPathBasename(file);
      return filename === RULES_MARKDOWN_FILENAME;
    });

    // Process each rules.md file
    for (const filePath of rulesMdFiles) {
      try {
        const content = await ide.readFile(filePath);
        const { relativePathOrBasename, foundInDir, uri } = findUriInDirs(
          filePath,
          await ide.getWorkspaceDirs(),
        );
        if (foundInDir) {
          const lastSlashIndex = relativePathOrBasename.lastIndexOf("/");
          const parentDir = relativePathOrBasename.substring(0, lastSlashIndex);
          const rule = markdownToRule(
            content,
            {
              uriType: "file",
              fileUri: uri,
            },
            parentDir,
          );

          rules.push({
            ...rule,
            source: "colocated-markdown",
            sourceFile: filePath,
          });
        } else {
          console.warn(
            `Failed to load codebase rule ${uri}: URI not found in workspace dirs`,
          );
        }
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
