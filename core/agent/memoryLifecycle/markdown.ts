import { parseMarkdownRule } from "@yutoagentic/config-yaml";
import * as YAML from "yaml";

export function wrapMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  markdown: string,
): string {
  const yaml = YAML.stringify(frontmatter).trimEnd();
  const body = markdown.trim();
  return `---\n${yaml}\n---\n\n${body}\n`;
}

export function stripMarkdownFrontmatter(content: string): string {
  return parseMarkdownRule(content).markdown.trim();
}
