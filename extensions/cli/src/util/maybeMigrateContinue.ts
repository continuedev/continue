import * as readline from "node:readline";

import {
  detectContinueMigration,
  type MigrationPromptResult,
  runContinueMigration,
} from "core/util/migrationFromContinue.js";

import { safeStderr } from "../init.js";

/**
 * In the CLI we run the migration prompt synchronously on startup so the
 * user sees the dialog before any commands execute. Skipped in headless
 * mode (`-p`/`--print`) because we cannot ask interactive questions.
 */
export async function maybeMigrateContinue(opts: {
  isInteractive: boolean;
}): Promise<void> {
  if (!opts.isInteractive) {
    return;
  }

  let detection;
  try {
    detection = detectContinueMigration();
  } catch {
    return;
  }
  if (!detection.shouldPrompt) {
    return;
  }

  await runContinueMigration(detection, async () => {
    safeStderr(
      `\nFound an existing Continue config at ${detection.legacyDir}.\n` +
        `Copy it to ${detection.newDir} so Yuto Agentic can use it? [Y/n] `,
    );
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    return new Promise<MigrationPromptResult>((resolve) => {
      rl.question("", (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        const accept = trimmed === "" || trimmed === "y" || trimmed === "yes";
        resolve(accept ? "accept" : "decline");
      });
    });
  })
    .then((res: { accepted: boolean; filesCopied: number }) => {
      if (res.accepted) {
        safeStderr(
          `\nCopied ${res.filesCopied} file(s) from ~/.continue to ~/.yutoagentic.\n`,
        );
      } else {
        safeStderr(
          "\nSkipping migration. You can run it later by deleting ~/.yutoagentic/.migrated_from_continue.\n",
        );
      }
    })
    .catch(() => {
      // Migration is best-effort; never block startup on a failure.
    });
}
