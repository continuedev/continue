import {
  ConfigValidationError,
  parseMarkdownRule,
} from "@yutoagentic/config-yaml";
import z from "zod";
import { IDE, Skill } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { localPathToUri } from "../../util/pathToUri";
import { getGlobalFolderWithName } from "../../util/paths";
import { findUriInDirs, joinPathsToUri } from "../../util/uri";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

const skillFrontmatterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  when_to_use: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  context: z.enum(["inline", "fork"]).optional(),
  agent: z.string().min(1).optional(),
  "argument-hint": z.string().min(1).optional(),
  "user-invocable": z.union([z.boolean(), z.string()]).optional(),
  "allowed-tools": z.union([z.string(), z.array(z.string())]).optional(),
  paths: z.union([z.string(), z.array(z.string())]).optional(),
});

const SKILLS_DIR = "skills";

function parseBooleanFrontmatterValue(
  value: boolean | string | undefined,
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function parseStringList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : value.split(",");
  return parts.map((item) => item.trim()).filter(Boolean);
}

function extractDescriptionFallback(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstDescriptiveLine = lines.find(
    (line) =>
      !line.startsWith("#") &&
      !line.startsWith("```") &&
      !line.startsWith("- ") &&
      !line.startsWith("* "),
  );
  return firstDescriptiveLine ?? "Skill";
}

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
          source: "get .claude skills files",
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

    const workspaceDirs = await ide.getWorkspaceDirs();
    const seenPaths = new Set<string>();
    for (const fileUri of skillFiles) {
      try {
        const content = await ide.readFile(fileUri);
        const { frontmatter, markdown } = parseMarkdownRule(
          content,
        ) as unknown as { frontmatter: Skill; markdown: string };

        const validatedFrontmatter = skillFrontmatterSchema.parse(frontmatter);
        const skillDir = fileUri.substring(0, fileUri.lastIndexOf("/"));

        const canonicalFileUri = (() => {
          // Normalize URI shape for dedupe when multiple workspace roots overlap.
          return fileUri.replace(/\/+/g, "/");
        })();
        if (seenPaths.has(canonicalFileUri)) {
          continue;
        }
        seenPaths.add(canonicalFileUri);

        const defaultSkillName = skillDir.split("/").pop() || "skill";
        const skillName = validatedFrontmatter.name ?? defaultSkillName;
        const description =
          validatedFrontmatter.description ??
          extractDescriptionFallback(markdown);

        const filesInSkillsDirectory = (
          await walkDir(skillDir, ide, {
            source: "get skill files",
          })
        )
          // do not include SKILL.md as it is already in content
          .filter((file) => !file.endsWith("SKILL.md"));

        const foundRelativeUri = findUriInDirs(fileUri, workspaceDirs);

        skills.push({
          name: skillName,
          description,
          content: markdown,
          path: foundRelativeUri.foundInDir
            ? foundRelativeUri.relativePathOrBasename
            : fileUri,
          files: filesInSkillsDirectory,
          whenToUse: validatedFrontmatter.when_to_use,
          argumentHint: validatedFrontmatter["argument-hint"],
          allowedTools: parseStringList(validatedFrontmatter["allowed-tools"]),
          userInvocable:
            parseBooleanFrontmatterValue(
              validatedFrontmatter["user-invocable"],
            ) ?? true,
          paths: parseStringList(validatedFrontmatter.paths),
          version: validatedFrontmatter.version,
          model: validatedFrontmatter.model,
          context: validatedFrontmatter.context,
          agent: validatedFrontmatter.agent,
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
