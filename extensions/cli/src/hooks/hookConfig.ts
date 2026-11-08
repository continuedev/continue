/**
 * Hook configuration loader.
 *
 * Loads hooks from settings files in the same locations as Claude Code:
 * - ~/.continue/settings.json  (user-global)
 * - .continue/settings.json    (project, committable)
 * - .continue/settings.local.json (project-local, gitignored)
 *
 * Also supports Claude Code's native locations for cross-compatibility:
 * - ~/.claude/settings.json
 * - .claude/settings.json
 * - .claude/settings.local.json
 *
 * Hooks from all sources are merged (project > user, continue > claude).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { logger } from "../util/logger.js";

import {
  fingerprintProjectHooks,
  getGlobalDir,
  isProjectHooksTrustedForRun,
  isProjectTrusted,
  listProjectHandlers,
  realPath,
} from "./hookTrust.js";
import type { ProjectHookFile } from "./hookTrust.js";
import type {
  HookMatcherGroup,
  HookSettingsFile,
  HooksConfig,
} from "./types.js";

/**
 * Load and parse a settings JSON file, returning only the hooks portion.
 * Returns null if file doesn't exist or fails to parse.
 */
function loadSettingsFile(filePath: string): HookSettingsFile | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed as HookSettingsFile;
  } catch (error) {
    logger.warn(`Failed to load hooks settings from ${filePath}:`, error);
    return null;
  }
}

/**
 * Merge two hook configs. Later config entries are appended (not replaced).
 * This matches Claude Code's behavior: hooks from multiple sources all run.
 */
function mergeHooksConfigs(
  base: HooksConfig,
  overlay: HooksConfig,
): HooksConfig {
  const merged: HooksConfig = { ...base };

  for (const [eventName, matcherGroups] of Object.entries(overlay)) {
    const key = eventName as keyof HooksConfig;
    if (merged[key]) {
      merged[key] = [...merged[key]!, ...matcherGroups!];
    } else {
      merged[key] = matcherGroups;
    }
  }

  return merged;
}

/**
 * Settings files that belong to the user. These always load.
 */
function getUserSettingsFilePaths(cwd: string, homeDir?: string): string[] {
  const home = homeDir ?? os.homedir();
  const paths = [path.join(home, ".claude", "settings.json")];
  // Undefined when CONTINUE_GLOBAL_DIR points inside the project; see hookTrust.
  const globalDir = getGlobalDir(cwd, homeDir);
  if (globalDir) paths.push(path.join(globalDir, "settings.json"));
  return paths;
}

/**
 * Settings files that come with the project, lowest precedence first. They
 * load only once the user has trusted them.
 */
function getProjectSettingsFilePaths(cwd: string): string[] {
  return [
    path.join(cwd, ".claude", "settings.json"),
    path.join(cwd, ".continue", "settings.json"),
    path.join(cwd, ".continuous", "settings.json"),
    // Project-local (highest precedence)
    path.join(cwd, ".claude", "settings.local.json"),
    path.join(cwd, ".continue", "settings.local.json"),
    path.join(cwd, ".continuous", "settings.local.json"),
  ];
}

/**
 * The project's settings files that define hooks (or switch them off). A file
 * that is really one of the user's files, as when `cn` runs from the home
 * directory, is not a project file.
 */
export function getProjectHookFiles(
  cwd: string,
  homeDir?: string,
): ProjectHookFile[] {
  const userFiles = new Set(
    getUserSettingsFilePaths(cwd, homeDir).map(realPath),
  );
  const files: ProjectHookFile[] = [];
  for (const filePath of getProjectSettingsFilePaths(cwd)) {
    if (userFiles.has(realPath(filePath))) continue;
    const settings = loadSettingsFile(filePath);
    if (!settings?.hooks && !settings?.disableAllHooks) continue;
    files.push({
      path: filePath,
      hooks: settings.hooks ?? {},
      disableAllHooks: settings.disableAllHooks,
    });
  }
  return files;
}

/** Project hooks that were found but are not running because they are not trusted. */
export interface UntrustedProjectHooks {
  files: ProjectHookFile[];
  fingerprint: string;
  /** `[event] command: ...` lines, for showing what would run */
  handlers: string[];
}

export interface LoadedHooksConfig {
  hooks: HooksConfig;
  disabled: boolean;
  untrustedProject?: UntrustedProjectHooks;
}

/**
 * Load hook configurations and merge them. The user's own files always load.
 * The project's files load only if the user trusted this project with these
 * exact hooks, or passed --trust-project-hooks for this run; otherwise they
 * are reported in `untrustedProject` and nothing from them runs, including a
 * `disableAllHooks` that would silence the user's own hooks.
 */
export function loadHooksConfig(
  cwd: string = process.cwd(),
  homeDir?: string,
): LoadedHooksConfig {
  let mergedHooks: HooksConfig = {};
  let disabled = false;

  const apply = (settings: {
    hooks?: HooksConfig;
    disableAllHooks?: boolean;
  }) => {
    if (settings.disableAllHooks) disabled = true;
    if (settings.hooks)
      mergedHooks = mergeHooksConfigs(mergedHooks, settings.hooks);
  };

  for (const filePath of getUserSettingsFilePaths(cwd, homeDir)) {
    const settings = loadSettingsFile(filePath);
    if (settings) apply(settings);
  }

  const projectFiles = getProjectHookFiles(cwd, homeDir);
  if (projectFiles.length === 0) return { hooks: mergedHooks, disabled };

  const fingerprint = fingerprintProjectHooks(cwd, projectFiles);
  if (
    isProjectHooksTrustedForRun() ||
    isProjectTrusted(cwd, fingerprint, homeDir)
  ) {
    projectFiles.forEach(apply);
    return { hooks: mergedHooks, disabled };
  }

  return {
    hooks: mergedHooks,
    disabled,
    untrustedProject: {
      files: projectFiles,
      fingerprint,
      handlers: listProjectHandlers(projectFiles),
    },
  };
}

/**
 * Get matching hook handlers for a given event and matcher value.
 *
 * @param config - The merged hooks config
 * @param eventName - The hook event name
 * @param matcherValue - The value to match against (e.g., tool name). Undefined for events without matchers.
 * @returns Array of matching hook handler groups
 */
export function getMatchingHookGroups(
  config: HooksConfig,
  eventName: string,
  matcherValue?: string,
): HookMatcherGroup[] {
  const groups = config[eventName as keyof HooksConfig];
  if (!groups) return [];

  return groups.filter((group) => {
    // No matcher, empty matcher, or "*" = match all
    if (!group.matcher || group.matcher === "" || group.matcher === "*") {
      return true;
    }

    // If no matcher value provided (e.g., events without matcher support), match all
    if (matcherValue === undefined) {
      return true;
    }

    // Regex match
    try {
      const regex = new RegExp(group.matcher);
      return regex.test(matcherValue);
    } catch (error) {
      logger.warn(
        `Invalid hook matcher regex "${group.matcher}" for event ${eventName}:`,
        error,
      );
      return false;
    }
  });
}
