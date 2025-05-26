import { basename } from "path";
import * as YAML from "yaml";
import { RuleWithSource } from "../..";

export interface RuleFrontmatter {
  globs?: RuleWithSource["globs"];
  name?: RuleWithSource["name"];
  description?: RuleWithSource["description"];
  alwaysApply?: RuleWithSource["alwaysApply"];
}

/**
 * Parses markdown content with YAML frontmatter
 */
export function parseMarkdownRule(content: string): {
  frontmatter: RuleFrontmatter;
  markdown: string;
} {
  // Normalize line endings to \n
  const normalizedContent = content.replace(/\r\n/g, "\n");

  // More reliable frontmatter detection
  const parts = normalizedContent.split(/^---\s*$/m);

  // If we have at least 3 parts (before ---, frontmatter, after ---), we have frontmatter
  if (parts.length >= 3) {
    const frontmatterStr = parts[1];
    // Join the remaining parts back together (in case there are more --- in the markdown)
    const markdownContent = parts.slice(2).join("---");

    try {
      // Parse YAML frontmatter
      const frontmatter = YAML.parse(frontmatterStr) || {}; // Handle empty frontmatter
      return { frontmatter, markdown: markdownContent.trim() };
    } catch (e) {
      // Error parsing frontmatter, treat as markdown only
      console.warn("Error parsing markdown frontmatter:", e);
      return { frontmatter: {}, markdown: normalizedContent };
    }
  }

  // No frontmatter found
  return { frontmatter: {}, markdown: normalizedContent };
}

/**
 * Converts a markdown file with YAML frontmatter to a RuleWithSource object
 */
export function convertMarkdownRuleToContinueRule(
  path: string,
  content: string,
): RuleWithSource {
  const { frontmatter, markdown } = parseMarkdownRule(content);

  // Try to extract title from first heading if no name in frontmatter
  let name = frontmatter.name;
  if (!name) {
    // Look for a heading in the markdown
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      name = headingMatch[1].trim();
    } else {
      // Fall back to filename
      name = basename(path).replace(/\.md$/, "");
    }
  }

  return {
    name,
    rule: markdown,
    globs: frontmatter.globs,
    description: frontmatter.description,
    alwaysApply: frontmatter.alwaysApply,
    source: "rules-block",
    ruleFile: path,
  };
}
