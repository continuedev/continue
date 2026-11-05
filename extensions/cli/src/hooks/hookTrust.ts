/**
 * Trust for project-level hook files.
 *
 * A hook is a shell command. Project settings files (`.continue/settings.json`
 * and `.claude/settings.json` in the working directory, plus their
 * `settings.local.json` siblings) come with a cloned repository, so they must
 * not run until the user has looked at them. Trust is recorded per project
 * together with a fingerprint of the hook definitions, so changing the hooks
 * asks again.
 *
 * Two things a repository must not be able to influence:
 * - Where the user-level settings and the trust record live. The CLI loads a
 *   `.env` from the working directory (see env.ts), and dotenv fills in any
 *   variable that is not already set. CONTINUE_GLOBAL_DIR is normally unset,
 *   so a repository could point it at its own directory and pass its settings
 *   off as the user's. A global directory inside the project is refused.
 *   (HOME and USERPROFILE are always set, so dotenv leaves them alone.)
 * - The decision to trust. There is deliberately no environment variable for
 *   it, for the same reason. Only --trust-project-hooks and `cn hooks trust`
 *   grant it.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { logger } from "../util/logger.js";

import type { HookHandler, HooksConfig } from "./types.js";

const TRUST_FILE = "trusted-hooks.json";

/** Set from --trust-project-hooks. Lasts for this process only. */
let trustForThisRun = false;

export function setTrustProjectHooksForRun(value: boolean): void {
  trustForThisRun = value;
}

export function isProjectHooksTrustedForRun(): boolean {
  return trustForThisRun;
}

/**
 * The real path of `p`, resolving symlinks and Windows short names. A path
 * that does not exist yet is resolved through its nearest existing ancestor,
 * so two spellings of the same location compare equal.
 */
export function realPath(p: string): string {
  let current = path.resolve(p);
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...rest.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(p);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * The user's Continue directory, or undefined when CONTINUE_GLOBAL_DIR points
 * inside the project. `homeDir` is for tests.
 */
export function getGlobalDir(
  cwd: string,
  homeDir?: string,
): string | undefined {
  const fromEnv = process.env.CONTINUE_GLOBAL_DIR;
  if (!fromEnv) return path.join(homeDir ?? os.homedir(), ".continue");

  const dir = path.resolve(cwd, fromEnv);
  if (isInside(realPath(dir), realPath(cwd))) {
    logger.warn(
      `Ignoring CONTINUE_GLOBAL_DIR=${fromEnv} for hooks because it is inside the project (${cwd}). User-level hooks and project trust are unavailable.`,
    );
    return undefined;
  }
  return dir;
}

/** The key a project is recorded under: its real path, folded on Windows. */
export function projectKey(cwd: string): string {
  const real = realPath(cwd);
  return process.platform === "win32" ? real.toLowerCase() : real;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** One project settings file and what it asks to run or switch off. */
export interface ProjectHookFile {
  path: string;
  hooks: HooksConfig;
  /** A project file can switch off the user's own hooks; that needs trust too. */
  disableAllHooks?: boolean;
}

/**
 * A hash of what would run: each file's path (relative to the project, so the
 * clone can move) and its hooks. Any change to a command, matcher, timeout or
 * `onError` produces a different value.
 */
export function fingerprintProjectHooks(
  cwd: string,
  files: ProjectHookFile[],
): string {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    const relative = path.relative(cwd, file.path).split(path.sep).join("/");
    const content = stableStringify({
      hooks: file.hooks,
      disableAllHooks: !!file.disableAllHooks,
    });
    hash.update(`${relative}\0${content}\0`);
  }
  return hash.digest("hex");
}

/** A one-line description of a handler, for showing what would run. */
function describeHandlerForTrust(handler: HookHandler): string {
  switch (handler.type) {
    case "command":
      return `command: ${handler.command}`;
    case "http":
      return `http: ${handler.url}`;
    default: {
      const other = handler as { type?: string; prompt?: string };
      return `${other.type}: ${other.prompt ?? ""}`;
    }
  }
}

/** Every handler in the files, as `[event] description` lines. */
export function listProjectHandlers(files: ProjectHookFile[]): string[] {
  const lines: string[] = [];
  for (const file of files) {
    if (file.disableAllHooks) {
      lines.push("[disableAllHooks] turns off all hooks, including your own");
    }
    for (const [event, groups] of Object.entries(file.hooks)) {
      for (const group of groups ?? []) {
        for (const handler of group.hooks) {
          lines.push(`[${event}] ${describeHandlerForTrust(handler)}`);
        }
      }
    }
  }
  return lines;
}

interface TrustRecord {
  version: 1;
  projects: Record<string, { fingerprint: string; trustedAt: string }>;
}

function readTrust(file: string): TrustRecord {
  const empty: TrustRecord = { version: 1, projects: {} };
  try {
    if (!fs.existsSync(file)) return empty;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (parsed?.version !== 1 || typeof parsed.projects !== "object") {
      return empty;
    }
    return parsed as TrustRecord;
  } catch (error) {
    // An unreadable record means nothing is trusted, never everything.
    logger.warn(`Could not read ${file}; no project hooks are trusted`, error);
    return empty;
  }
}

function trustFile(cwd: string, homeDir?: string): string | undefined {
  const dir = getGlobalDir(cwd, homeDir);
  return dir ? path.join(dir, TRUST_FILE) : undefined;
}

function writeTrust(file: string, record: TrustRecord): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write beside the target and rename, so a crash cannot leave half a file.
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(record, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

/** True when this project was trusted with exactly these hooks. */
export function isProjectTrusted(
  cwd: string,
  fingerprint: string,
  homeDir?: string,
): boolean {
  const file = trustFile(cwd, homeDir);
  if (!file) return false;
  const entry = readTrust(file).projects[projectKey(cwd)];
  return entry?.fingerprint === fingerprint;
}

/** Remember that the user trusts these hooks in this project. */
export function trustProject(
  cwd: string,
  fingerprint: string,
  homeDir?: string,
): void {
  const file = trustFile(cwd, homeDir);
  if (!file) {
    throw new Error(
      "The Continue directory is inside this project, so trust cannot be saved. Unset CONTINUE_GLOBAL_DIR or point it outside the project.",
    );
  }
  const record = readTrust(file);
  record.projects[projectKey(cwd)] = {
    fingerprint,
    trustedAt: new Date().toISOString(),
  };
  writeTrust(file, record);
}

/** Forget a project's trust, so its hooks stop running. */
export function revokeProject(cwd: string, homeDir?: string): boolean {
  const file = trustFile(cwd, homeDir);
  if (!file) return false;
  const record = readTrust(file);
  const key = projectKey(cwd);
  if (!(key in record.projects)) return false;
  delete record.projects[key];
  writeTrust(file, record);
  return true;
}
