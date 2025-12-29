import { ConfigValidationError } from "@continuedev/config-yaml";
import * as YAML from "yaml";
import { IDE, Skill } from "../..";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

// todo: refactor this to packages/config-yaml (like parseMarkdownRule)
function parseSkillMarkdown(content: string): Skill {
  const normalizedContent = content.replace(/\r\n/g, "\n");

  const parts = normalizedContent.split(/^---\s*$/m);

  if (parts.length < 3) {
    throw new Error("Invalid skill markdown file");
  }
  const frontmatterStr = parts[1];
  const markdownContent = parts.slice(2).join("---");

  const frontmatter = YAML.parse(frontmatterStr) || {}; // Handle empty frontmatter
  // todo: validate frontmatter with zod

  return {
    ...frontmatter,
    content: markdownContent,
  };
}

export async function loadMarkdownSkills(ide: IDE) {
  const errors: ConfigValidationError[] = [];
  const skills: Skill[] = [];

  try {
    const yamlAndMarkdownFiles = await getAllDotContinueDefinitionFiles(
      ide,
      {
        includeGlobal: true,
        includeWorkspace: true,
        fileExtType: "markdown",
      },
      "", // SKILL.md can exist in any .continue subdirectory
    );

    const skillFiles = yamlAndMarkdownFiles.filter((file) =>
      file.path.endsWith("SKILL.md"),
    );
    for (const file of skillFiles) {
      try {
        const skill = parseSkillMarkdown(file.content);
        skills.push({ ...skill, path: file.path.slice(7) });
      } catch (error) {
        errors.push({
          fatal: false,
          message: `Failed to parse markdown skill file: ${error instanceof Error ? error.message : error}`,
        });
      }
    }
  } catch (err) {
    errors.push({
      fatal: false,
      message: `Error loading markdown skill files: ${err instanceof Error ? err.message : err}`,
    });
  }

  return { skills, errors };
}
