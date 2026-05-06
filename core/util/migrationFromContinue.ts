/**
 * One-time migration helper for users coming from a Continue install.
 *
 * Detects an existing `~/.continue/` directory next to the new
 * `~/.yutoagentic/` directory and offers to copy it over so the user keeps
 * their assistants, sessions, and config without manual steps.
 *
 * The host (CLI / VS Code / JetBrains) supplies the prompt callback so this
 * module stays free of UI dependencies.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { BRAND } from "./brand.js";

export type MigrationPromptResult = "accept" | "decline";

export interface MigrationDetection {
  legacyDir: string;
  newDir: string;
  /** True when `~/.continue` exists, `~/.yutoagentic` does not, and we have not asked before. */
  shouldPrompt: boolean;
  /** True when the marker file already exists (user already answered). */
  alreadyHandled: boolean;
}

const MARKER_FILE = ".migrated_from_continue";

export function detectContinueMigration(
  homeDir: string = os.homedir(),
): MigrationDetection {
  const legacyDir = path.join(homeDir, BRAND.LEGACY.GLOBAL_DIR_NAME);
  const newDir = path.join(homeDir, BRAND.GLOBAL_DIR_NAME);
  const markerPath = path.join(newDir, MARKER_FILE);

  const legacyExists = fs.existsSync(legacyDir);
  const newExists = fs.existsSync(newDir);
  const alreadyHandled = newExists && fs.existsSync(markerPath);

  return {
    legacyDir,
    newDir,
    shouldPrompt: legacyExists && !alreadyHandled,
    alreadyHandled,
  };
}

/**
 * Recursively copy `src` into `dest`. Skips entries that already exist in
 * `dest` so re-runs are safe. Returns the number of files copied.
 */
function copyDirRecursive(src: string, dest: string): number {
  let copied = 0;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile() && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      copied += 1;
    }
  }
  return copied;
}

/**
 * Run the migration. Returns the count of files copied. Always writes the
 * marker file (even on decline) so the user is not prompted again.
 */
export async function runContinueMigration(
  detection: MigrationDetection,
  prompt: () => Promise<MigrationPromptResult>,
): Promise<{ accepted: boolean; filesCopied: number }> {
  if (!detection.shouldPrompt) {
    return { accepted: false, filesCopied: 0 };
  }

  const result = await prompt();
  if (!fs.existsSync(detection.newDir)) {
    fs.mkdirSync(detection.newDir, { recursive: true });
  }

  let copied = 0;
  if (result === "accept") {
    copied = copyDirRecursive(detection.legacyDir, detection.newDir);
  }

  fs.writeFileSync(
    path.join(detection.newDir, MARKER_FILE),
    JSON.stringify(
      {
        decision: result,
        copiedFiles: copied,
        timestamp: new Date().toISOString(),
        source: detection.legacyDir,
      },
      null,
      2,
    ),
  );

  return { accepted: result === "accept", filesCopied: copied };
}
