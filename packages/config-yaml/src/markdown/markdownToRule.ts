import * as YAML from "yaml";
import {
  PackageIdentifier,
  packageIdentifierToDisplayName,
} from "../browser.js";
import { RuleObject } from "../schemas/index.js";

export interface RuleFrontmatter {
  globs?: RuleObject["globs"];
  regex?: RuleObject["regex"];
  name?: RuleObject["name"];
  description?: RuleObject["description"];
  alwaysApply?: RuleObject["alwaysApply"];
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

export function getRuleName(
  frontmatter: RuleFrontmatter,
  id: PackageIdentifier,
): string {
  if (frontmatter.name) {
    return frontmatter.name;
  }

  const displayName = packageIdentifierToDisplayName(id);

  // If it's a file identifier, extract the last two parts of the file path
  if (id.uriType === "file") {
    // Handle both forward slashes and backslashes, get the last two segments
    const segments = displayName.split(/[/\\]/);
    const lastTwoParts = segments.slice(-2);
    return lastTwoParts.join("/");
  }

  // Otherwise return the display name as-is (for slug identifiers)
  return displayName;
}

export function markdownToRule(
  rule: string,
  id: PackageIdentifier,
): RuleObject {
  const { frontmatter, markdown } = parseMarkdownRule(rule);

  return {
    name: getRuleName(frontmatter, id),
    rule: markdown,
    globs: frontmatter.globs,
    regex: frontmatter.regex,
    description: frontmatter.description,
    alwaysApply: frontmatter.alwaysApply,
  };
}
