import type { ConfigValidationError } from "@continuedev/config-yaml";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import z from "zod";
import type { IDE, Skill } from "../..";
import { localPathToUri } from "../../util/pathToUri";
import { getGlobalFolderWithName } from "../../util/paths";
import { getUriPathBasename, joinPathsToUri } from "../../util/uri";

const skillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u),
  description: z.string().trim().min(1).max(1024),
  license: z.string().optional(),
  compatibility: z.string().min(1).max(500).optional(),
  metadata: z.record(z.string()).optional(),
  "allowed-tools": z.string().optional(),
  "disable-model-invocation": z.boolean().optional(),
  "argument-hint": z.string().optional(),
});

const SKILL_LOCATIONS = [".continue", ".agents", ".claude", ".codex"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".venv", "__pycache__"]);
const MAX_DIRECTORIES = 2000;
const MAX_DEPTH = 6;

export function isSkillFileUri(uri: string): boolean {
  return (
    uri.endsWith("/SKILL.md") &&
    SKILL_LOCATIONS.some((dir) => uri.includes(`/${dir}/skills/`))
  );
}

/** Workspace roots win over user roots; within each scope use the order above. */
export async function loadMarkdownSkills(
  ide: IDE,
  includeResources = true,
  selectedSkillName?: string,
) {
  const errors: ConfigValidationError[] = [];
  const skills: Skill[] = [];
  const names = new Map<string, string>();
  let workspaceDirs: string[];
  try {
    workspaceDirs = await ide.getWorkspaceDirs();
  } catch (error) {
    errors.push({
      fatal: false,
      message: `Cannot discover skill workspaces: ${error instanceof Error ? error.message : error}`,
    });
    return { skills, errors };
  }
  const roots = workspaceDirs.flatMap((dir) =>
    SKILL_LOCATIONS.map((location) => joinPathsToUri(dir, location, "skills")),
  );
  roots.push(localPathToUri(getGlobalFolderWithName("skills")));
  for (const location of SKILL_LOCATIONS.slice(1)) {
    roots.push(localPathToUri(path.join(os.homedir(), location, "skills")));
  }
  // Bundled defaults have lower precedence than project and personal skills.
  try {
    const bundledDir = await ide.getBundledSkillsDir?.();
    if (bundledDir) roots.push(bundledDir);
  } catch (error) {
    errors.push({
      fatal: false,
      message: `Cannot locate bundled skills: ${error instanceof Error ? error.message : error}`,
    });
  }

  let visited = 0;
  let resourceDirectories = 0;
  const warn = (uri: string, message: string) =>
    errors.push({ fatal: false, message: `${uri}: ${message}` });

  async function scan(dir: string, depth: number): Promise<void> {
    if (++visited > MAX_DIRECTORIES || depth > MAX_DEPTH) {
      warn(dir, "Skill discovery limit reached; this directory was skipped.");
      return;
    }
    try {
      const entries = (await ide.listDir(dir)).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      if (entries.some(([name]) => name === "SKILL.md")) {
        const uri = joinPathsToUri(dir, "SKILL.md");
        try {
          const content = (await ide.readFile(uri))
            .replace(/^\uFEFF/, "")
            .replace(/\r\n/g, "\n");
          const match =
            /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(content);
          if (!match)
            throw new Error("SKILL.md must start with YAML frontmatter.");
          const metadata = skillFrontmatterSchema.parse(parse(match[1]));
          if (metadata.name !== getUriPathBasename(dir))
            throw new Error("Skill name must match its parent directory name.");
          const previous = names.get(metadata.name);
          if (previous) {
            warn(uri, `Skill "${metadata.name}" is shadowed by ${previous}.`);
            return;
          }
          const files =
            includeResources &&
            (!selectedSkillName || metadata.name === selectedSkillName)
              ? await listResources(dir, 0).catch((error) => {
                  warn(
                    dir,
                    `Cannot list supporting resources: ${error instanceof Error ? error.message : error}`,
                  );
                  return [];
                })
              : [];
          names.set(metadata.name, uri);
          skills.push({
            ...metadata,
            path: uri,
            content: match[2].trim(),
            files,
          });
        } catch (error) {
          warn(
            uri,
            `Failed to load skill: ${error instanceof Error ? error.message : error}`,
          );
        }
        return;
      }
      for (const [name, type] of entries) {
        if (visited >= MAX_DIRECTORIES) break;
        // VS Code uses a bitmask; symlinked skill directories may have both bits.
        if ((type & 2 || type & 64) && !SKIP_DIRS.has(name)) {
          await scan(joinPathsToUri(dir, name), depth + 1);
        }
      }
    } catch (error) {
      warn(
        dir,
        `Cannot read skills directory: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async function listResources(dir: string, depth: number): Promise<string[]> {
    if (depth > MAX_DEPTH || ++resourceDirectories > MAX_DIRECTORIES) return [];
    const files: string[] = [];
    for (const [name, type] of (await ide.listDir(dir)).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (name === "SKILL.md" || SKIP_DIRS.has(name)) continue;
      const uri = joinPathsToUri(dir, name);
      if (type & 2 && !(type & 64))
        files.push(...(await listResources(uri, depth + 1)));
      else if (type & 1) files.push(uri);
      if (files.length >= 500) return files.slice(0, 500);
    }
    return files;
  }

  for (const root of new Set(roots)) {
    if (visited >= MAX_DIRECTORIES) break;
    try {
      if (await ide.fileExists(root)) await scan(root, 0);
    } catch (error) {
      warn(
        root,
        `Cannot access skills directory: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  return { skills, errors };
}
