import path from "path";
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
  invokable?: RuleObject["invokable"];
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

function getGlobPattern(
  globs: RuleFrontmatter["globs"],
  id: PackageIdentifier,
) {
  if (id.uriType !== "file") {
    return globs;
  }
  let dir = path.dirname(id.fileUri);

  // TODO: This is likely causing bugs for Windows users.
  // We can't access `core/util/uri.ts` from this package though.
  if (dir.includes(".continue")) {
    return globs;
  }
  if (!dir.endsWith("/")) {
    dir = dir.concat("/");
  }
  const prependDirAndApplyGlobstar = (glob: string) => {
    if (glob.startsWith("**")) {
      return dir.concat(glob);
    }
    return dir.concat("**/", glob);
  };
  if (!globs) {
    return dir.concat("**/*");
  }
  if (Array.isArray(globs)) {
    return globs.map(prependDirAndApplyGlobstar);
  }
  return prependDirAndApplyGlobstar(globs);
}

export function markdownToRule(
  rule: string,
  id: PackageIdentifier,
): RuleObject {
  const { frontmatter, markdown } = parseMarkdownRule(rule);

  return {
    name: getRuleName(frontmatter, id),
    rule: markdown,
    globs: getGlobPattern(frontmatter.globs, id),
    regex: frontmatter.regex,
    description: frontmatter.description,
    alwaysApply: frontmatter.alwaysApply,
    invokable: frontmatter.invokable,
    sourceFile: id.uriType === "file" ? id.fileUri : undefined,
  };
}
