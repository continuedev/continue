/**
 * The workspace folder for configs, rules, prompts, agents and plans, and the
 * file names that go with it. Before 2.4.2 they were `.continue`,
 * `.continueignore` and `.continuerc.json`; those are still read (after the
 * new ones), and new files are written under the new names.
 *
 * No fs or node imports: the GUI uses this too.
 */
export const WORKSPACE_DIR = ".continuous";
export const LEGACY_WORKSPACE_DIR = ".continue";
/** Read in this order. */
export const WORKSPACE_DIRS = [WORKSPACE_DIR, LEGACY_WORKSPACE_DIR] as const;

export const IGNORE_FILE = ".continuousignore";
export const LEGACY_IGNORE_FILE = ".continueignore";
export const IGNORE_FILES = [IGNORE_FILE, LEGACY_IGNORE_FILE] as const;

export const RC_FILE_SUFFIX = ".continuousrc.json";
export const LEGACY_RC_FILE_SUFFIX = ".continuerc.json";

/** Whether a URI or path has a `.continuous` or `.continue` folder in it. */
export function isInWorkspaceConfigDir(uri: string): boolean {
  return /(^|[\\/])\.continu(e|ous)([\\/]|$)/.test(uri);
}

/**
 * Whether a URI or path is inside `<.continuous or .continue>/<sub>/`, for
 * example `agents`.
 */
export function isInWorkspaceConfigSubdir(uri: string, sub: string): boolean {
  const escaped = sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[\\\\/])\\.continu(e|ous)[\\\\/]${escaped}([\\\\/]|$)`,
  ).test(uri);
}

export function isIgnoreFile(uriOrName: string): boolean {
  return IGNORE_FILES.some((name) => uriOrName.endsWith(name));
}

export function isRcFile(uriOrName: string): boolean {
  return (
    uriOrName.endsWith(RC_FILE_SUFFIX) ||
    uriOrName.endsWith(LEGACY_RC_FILE_SUFFIX)
  );
}
