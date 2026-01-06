import {
  ConfigValidationError,
  parseMarkdownRule,
} from "@continuedev/config-yaml";
import z from "zod";
import { IDE, Skill } from "../..";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

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
        const { frontmatter, markdown } = parseMarkdownRule(
          file.content,
        ) as unknown as { frontmatter: Skill; markdown: string };

        const validatedFrontmatter = skillFrontmatterSchema.parse(frontmatter);

        skills.push({
          ...validatedFrontmatter,
          content: markdown,
          path: file.path.slice(7),
        });
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
