import * as YAML from "yaml";

export interface PromptFrontmatter {
  name?: string;
  description?: string;
  invokable?: boolean;
}

/**
 * Creates markdown content with YAML frontmatter for prompts
 */
export function createMarkdownWithPromptFrontmatter(
  frontmatter: PromptFrontmatter,
  prompt: string,
): string {
  const frontmatterStr = YAML.stringify(frontmatter).trim();
  return `---\n${frontmatterStr}\n---\n\n${prompt}`;
}

/**
 * Creates a prompt markdown file content from prompt components
 */
export function createPromptMarkdown(
  name: string,
  promptContent: string,
  options: {
    description?: string;
    invokable?: boolean;
  } = {},
): string {
  const frontmatter: PromptFrontmatter = {
    name: name.trim(),
  };

  if (options.description) {
    frontmatter.description = options.description.trim();
  }

  if (options.invokable !== undefined) {
    frontmatter.invokable = options.invokable;
  }

  return createMarkdownWithPromptFrontmatter(frontmatter, promptContent);
}
