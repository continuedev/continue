import * as fs from "fs";
import fsPromises from "fs/promises";
import * as path from "path";

import { parseMarkdownRule } from "@continuedev/config-yaml";
import { WalkerSync } from "ignore-walk";
import { z } from "zod";

import { env } from "../env.js";

export interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
  files: string[];
}

export interface LoadSkillsResult {
  skills: Skill[];
  errors: { fatal: boolean; message: string }[];
}

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const SKILLS_DIR = "skills";

/**get the relative path if the filePath is within the current working directory
 * otherwise return the absolute path
 */
function getRelativePath(cwd: string, filePath: string) {
  return filePath.startsWith(cwd)
    ? path.join(".", path.relative(cwd, filePath))
    : filePath;
}

function getFilePathsInSkillDirectory(
  cwd: string,
  skillFilePath: string,
): string[] {
  const skillDir = path.dirname(skillFilePath);
  if (!fs.existsSync(skillDir)) return [];

  const walker = new WalkerSync({
    path: skillDir,
    includeEmpty: false,
    follow: false,
  });

  const files = walker.start().result as string[];
  return files
    .map((filePath) => path.join(skillDir, filePath))
    .filter((filePath) => !filePath.endsWith("SKILL.md"))
    .map((filePath) => getRelativePath(cwd, filePath));
}

/**get the SKILL.md files from the given directory */
async function getSkillFilesFromDir(dirPath: string): Promise<string[]> {
  // check if dirPath exists
  try {
    await fsPromises.stat(dirPath);
  } catch {
    return [];
  }

  const skillDirs = (await fsPromises.readdir(dirPath, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .map((dir) => path.join(dirPath, dir.name));

  return (
    await Promise.all(
      skillDirs.map(async (skillDir) => {
        try {
          const skillFilePath = path.join(skillDir, "SKILL.md");
          await fsPromises.stat(skillFilePath);
          return skillFilePath;
        } catch {
          return null;
        }
      }),
    )
  ).filter((path) => typeof path === "string");
}

export async function loadMarkdownSkills(): Promise<LoadSkillsResult> {
  const errors: { fatal: boolean; message: string }[] = [];
  const skills: Skill[] = [];

  const cwd = process.cwd();

  try {
    const skillsDirs = [
      path.join(cwd, ".continue", SKILLS_DIR),
      path.join(cwd, ".claude", SKILLS_DIR),
      path.join(env.continueHome, SKILLS_DIR),
    ];

    const skillFilePaths = (
      await Promise.all(
        skillsDirs.map((skillDir) => getSkillFilesFromDir(skillDir)),
      )
    ).flat();

    await Promise.all(
      skillFilePaths.map(async (skillFilePath) => {
        try {
          const content = await fsPromises.readFile(skillFilePath, "utf-8");
          const { frontmatter, markdown } = parseMarkdownRule(content) as {
            frontmatter: { name?: string; description?: string };
            markdown: string;
          };

          const validatedFrontmatter =
            skillFrontmatterSchema.parse(frontmatter);

          const filesInSkillsDirectory = getFilePathsInSkillDirectory(
            cwd,
            skillFilePath,
          );

          skills.push({
            ...validatedFrontmatter,
            content: markdown,
            path: getRelativePath(cwd, skillFilePath),
            files: filesInSkillsDirectory,
          });
        } catch (error) {
          errors.push({
            fatal: false,
            message: `Failed to parse markdown skill file: ${error instanceof Error ? error.message : error}`,
          });
        }
      }),
    );
  } catch (err) {
    errors.push({
      fatal: false,
      message: `Error loading markdown skill files: ${err instanceof Error ? err.message : err}`,
    });
  }

  return { skills, errors };
}
