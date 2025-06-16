import * as YAML from "yaml";
import {
  PackageIdentifier,
  packageIdentifierToDisplayName,
} from "../browser.js";
import { RuleObject } from "../schemas/index.js";

export interface RuleFrontmatter {
  globs?: RuleObject["globs"];
  name?: RuleObject["name"];
  description?: RuleObject["description"];
  alwaysApply?: RuleObject["alwaysApply"];
}

/**
 * Parses markdown content with YAML frontmatter
 */
function parseMarkdownRule(content: string): {
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

export function markdownToRule(
  rule: string,
  id: PackageIdentifier,
): RuleObject {
  const { frontmatter, markdown } = parseMarkdownRule(rule);

  return {
    name: frontmatter.name ?? packageIdentifierToDisplayName(id),
    rule: markdown,
    globs: frontmatter.globs,
    description: frontmatter.description,
    alwaysApply: frontmatter.alwaysApply,
  };
}
