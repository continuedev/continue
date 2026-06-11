import {
  PackageIdentifier,
  packageIdentifierToDisplayName,
} from "../browser.js";
import { Prompt } from "../schemas/index.js";
import { parseMarkdownRule, RuleFrontmatter } from "./markdownToRule.js";

function getPromptName(
  frontmatter: RuleFrontmatter,
  id: PackageIdentifier,
): string {
  if (frontmatter.name) {
    return frontmatter.name;
  }

  if (id.uriType === "file") {
    const segments = id.fileUri.split(/[/\\]/);
    const basename = segments.at(-1) || id.fileUri;
    return basename.replace(/\.md$/i, "");
  }

  return packageIdentifierToDisplayName(id);
}

export function parseMarkdownPrompt(
  content: string,
  id: PackageIdentifier,
): Prompt {
  const { frontmatter, markdown } = parseMarkdownRule(content);

  return {
    name: getPromptName(frontmatter, id),
    description: frontmatter.description,
    prompt: markdown,
    sourceFile: id.uriType === "file" ? id.fileUri : undefined,
  };
}
