import {
  ConfigValidationError,
  parseMarkdownRule,
} from "@continuedev/config-yaml";
import z from "zod";
import type { IDE, Skill } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { getGlobalFolderWithName } from "../../util/paths";
import { localPathToUri } from "../../util/pathToUri";
import { findUriInDirs, joinPathsToUri } from "../../util/uri";
import { getDotContinueSubDirs } from "../loadLocalAssistants";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const SKILLS_DIR = "skills";
const DIRECTORY_FILE_TYPE = 2;
const SYMBOLIC_LINK_FILE_TYPE = 64;

async function getSkillFilesFromDir(dir: string, ide: IDE): Promise<string[]> {
  const exists = await ide.fileExists(dir);
  if (!exists) {
    return [];
  }

  const entries = await ide.listDir(dir);
  return (
    await Promise.all(
      entries.map(async ([name, type]) => {
        if (type !== DIRECTORY_FILE_TYPE && type !== SYMBOLIC_LINK_FILE_TYPE) {
          return null;
        }

        const skillDirUri = joinPathsToUri(dir, name);
        const skillFileUri = joinPathsToUri(skillDirUri, "SKILL.md");
        return (await ide.fileExists(skillFileUri)) ? skillFileUri : null;
      }),
    )
  ).filter((skillFileUri): skillFileUri is string => Boolean(skillFileUri));
}

async function getSkillFilesFromDirs(
  dirs: string[],
  ide: IDE,
): Promise<string[]> {
  return (
    await Promise.all(dirs.map((dir) => getSkillFilesFromDir(dir, ide)))
  ).flat();
}

/**
 * Get skills from .claude/skills directory
 */
async function getClaudeSkillsDir(ide: IDE) {
  const fullDirs = (await ide.getWorkspaceDirs()).map((dir) =>
    joinPathsToUri(dir, ".claude", SKILLS_DIR),
  );

  fullDirs.push(localPathToUri(getGlobalFolderWithName(SKILLS_DIR)));

  return getSkillFilesFromDirs(fullDirs, ide);
}

export async function loadMarkdownSkills(ide: IDE) {
  const errors: ConfigValidationError[] = [];
  const skills: Skill[] = [];

  try {
    const workspaceDirs = await ide.getWorkspaceDirs();
    const yamlAndMarkdownFileUris = [
      ...(await getSkillFilesFromDirs(
        getDotContinueSubDirs(
          ide,
          {
            includeGlobal: true,
            includeWorkspace: true,
            fileExtType: "markdown",
          },
          workspaceDirs,
          SKILLS_DIR,
        ),
        ide,
      )),
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

        const filesInSkillsDirectory = (
          await walkDir(fileUri.substring(0, fileUri.lastIndexOf("/")), ide, {
            source: "get skill files",
          })
        )
          // do not include SKILL.md as it is already in content
          .filter((file) => !file.endsWith("SKILL.md"));

        const foundRelativeUri = findUriInDirs(fileUri, workspaceDirs);

        skills.push({
          ...validatedFrontmatter,
          content: markdown,
          path: foundRelativeUri.foundInDir
            ? foundRelativeUri.relativePathOrBasename
            : fileUri,
          files: filesInSkillsDirectory,
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
