import fsPromises from "fs/promises";
import * as path from "path";

import { env } from "../env.js";
import { logger } from "../util/logger.js";

/**
 * A bundled skill definition — skills that are packaged inline in code rather
 * than loaded from disk. Mirrors Marcel's BundledSkillDefinition pattern.
 */
export interface BundledSkillDefinition {
  /** Unique machine-readable identifier */
  name: string;
  /** Human-readable description shown to the model */
  description: string;
  /** Optional list of tool names this skill is allowed to use */
  allowedTools?: string[];
  /** Whether the model should be invoked (default: true) */
  disableModelInvocation?: boolean;
  /** Whether users can invoke this skill directly via slash command */
  userInvocable?: boolean;
  /**
   * Inline files to extract into `.continue/bundled/{name}/` on first use.
   * Keys are relative paths; values are file content strings.
   */
  files?: Record<string, string>;
  /**
   * Returns the prompt content for this skill given the user's args and
   * the base directory where inline files were extracted.
   */
  getPrompt: (args: string, baseDir: string) => string;
}

/** Registry of all bundled skill definitions */
const bundledSkillRegistry = new Map<string, BundledSkillDefinition>();
/** Track which skills have already had their files extracted (memoize) */
const extractedSkills = new Set<string>();

/**
 * Register a bundled skill definition.
 * Safe to call multiple times — duplicate registrations are ignored.
 */
export function registerBundledSkill(definition: BundledSkillDefinition): void {
  if (bundledSkillRegistry.has(definition.name)) {
    logger.debug(
      `BundledSkills: "${definition.name}" already registered, skipping`,
    );
    return;
  }
  bundledSkillRegistry.set(definition.name, definition);
  logger.debug(`BundledSkills: registered skill "${definition.name}"`);
}

/**
 * Get all registered bundled skill definitions.
 */
export function getBundledSkills(): BundledSkillDefinition[] {
  return Array.from(bundledSkillRegistry.values());
}

/**
 * Find a bundled skill by name (case-insensitive).
 */
export function findBundledSkill(
  name: string,
): BundledSkillDefinition | undefined {
  const lower = name.toLowerCase();
  for (const [key, def] of bundledSkillRegistry) {
    if (key.toLowerCase() === lower) return def;
  }
  return undefined;
}

/**
 * Extract inline files for a skill to disk under `.continue/bundled/{skillName}/`.
 * Uses a memoization set so extraction only happens once per process lifetime.
 *
 * @returns The directory where files were written
 */
export async function extractBundledSkillFiles(
  skill: BundledSkillDefinition,
): Promise<string> {
  const baseDir = path.join(
    env.continueHome,
    "bundled",
    skill.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
  );

  if (extractedSkills.has(skill.name)) {
    return baseDir;
  }

  if (!skill.files || Object.keys(skill.files).length === 0) {
    extractedSkills.add(skill.name);
    return baseDir;
  }

  try {
    await fsPromises.mkdir(baseDir, { recursive: true });

    await Promise.all(
      Object.entries(skill.files).map(async ([relativePath, content]) => {
        const fullPath = path.join(baseDir, relativePath);
        await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
        await fsPromises.writeFile(fullPath, content, "utf8");
      }),
    );

    extractedSkills.add(skill.name);
    logger.debug(`BundledSkills: extracted files for "${skill.name}"`, {
      baseDir,
      fileCount: Object.keys(skill.files).length,
    });
  } catch (err) {
    logger.error(
      `BundledSkills: failed to extract files for "${skill.name}"`,
      err,
    );
  }

  return baseDir;
}

/**
 * Execute a bundled skill: extract its files and return the resolved prompt.
 */
export async function runBundledSkill(
  skill: BundledSkillDefinition,
  args: string,
): Promise<string> {
  const baseDir = await extractBundledSkillFiles(skill);
  const prompt = skill.getPrompt(args, baseDir);

  const header = skill.files ? `Base directory: ${baseDir}\n\n` : "";

  return header + prompt;
}
