import {
  ConfigValidationError,
  parseMarkdownRule,
} from "@continuedev/config-yaml";
import z from "zod";
import { IDE, Skill } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { localPathToUri } from "../../util/pathToUri";
import { getGlobalFolderWithName } from "../../util/paths";
import { joinPathsToUri } from "../../util/uri";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const SKILLS_DIR = "skills";

/**
 * Get skills from .claude/skills directory
 */
async function getClaudeSkillsDir(ide: IDE) {
  const fullDirs = (await ide.getWorkspaceDirs()).map((dir) =>
    joinPathsToUri(dir, ".claude", SKILLS_DIR),
  );

  fullDirs.push(localPathToUri(getGlobalFolderWithName(SKILLS_DIR)));

  return (
    await Promise.all(
      fullDirs.map(async (dir) => {
        const exists = await ide.fileExists(dir);
        if (!exists) return [];
        const uris = await walkDir(dir, ide, {
          source: "get claude skills files",
        });
        // filter markdown files only
        return uris.filter((uri) => uri.endsWith(".md"));
      }),
    )
  ).flat();
}

export async function loadMarkdownSkills(ide: IDE) {
  const errors: ConfigValidationError[] = [];
  const skills: Skill[] = [];

  try {
    const yamlAndMarkdownFileUris = [
      ...(
        await getAllDotContinueDefinitionFiles(
          ide,
          {
            includeGlobal: true,
            includeWorkspace: true,
            fileExtType: "markdown",
          },
          SKILLS_DIR,
        )
      ).map((file) => file.path),
      ...(await getClaudeSkillsDir(ide)),
    ];

    const skillFiles = yamlAndMarkdownFileUris.filter((path) =>
      path.endsWith("SKILL.md"),
    );
    for (const fileUri of skillFiles) {
      try {
        const content = await ide.readFile(fileUri);
        const { frontmatter, markdown } = parseMarkdownRule(
          content,
        ) as unknown as { frontmatter: Skill; markdown: string };

        const validatedFrontmatter = skillFrontmatterSchema.parse(frontmatter);

        skills.push({
          ...validatedFrontmatter,
          content: markdown,
          path: fileUri,
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
