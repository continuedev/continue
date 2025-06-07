import * as YAML from "yaml";
import { joinPathsToUri } from "../../util/uri";
import { RuleFrontmatter } from "./parseMarkdownRule";

export const RULE_FILE_EXTENSION = "md";

/**
 * Sanitizes a rule name for use in filenames (removes special chars, replaces spaces with dashes)
 */
export function sanitizeRuleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

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

/**
 * Creates markdown content with YAML frontmatter in the format expected by parseMarkdownRule
 */
export function createMarkdownWithFrontmatter(
  frontmatter: RuleFrontmatter,
  markdown: string,
): string {
  const frontmatterStr = YAML.stringify(frontmatter).trim();
  return `---\n${frontmatterStr}\n---\n\n${markdown}`;
}

/**
 * Creates a rule markdown file content from rule components
 */
export function createRuleMarkdown(
  name: string,
  ruleContent: string,
  options: {
    description?: string;
    globs?: string | string[];
    alwaysApply?: boolean;
  } = {},
): string {
  const frontmatter: RuleFrontmatter = {};

  if (options.globs) {
    frontmatter.globs =
      typeof options.globs === "string" ? options.globs.trim() : options.globs;
  }

  if (options.description) {
    frontmatter.description = options.description.trim();
  }

  if (options.alwaysApply !== undefined) {
    frontmatter.alwaysApply = options.alwaysApply;
  }

  const markdownBody = `# ${name}\n\n${ruleContent}`;

  return createMarkdownWithFrontmatter(frontmatter, markdownBody);
}
