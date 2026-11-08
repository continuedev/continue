/**
 * `continuous hooks`: see which project hooks are waiting for trust, and grant or
 * withdraw it. Trust is recorded against what the hooks say right now, so
 * editing them asks again.
 */

import * as readline from "node:readline/promises";

import { getProjectHookFiles, loadHooksConfig } from "../hooks/hookConfig.js";
import {
  fingerprintProjectHooks,
  isProjectTrusted,
  listProjectHandlers,
  revokeProject,
  trustProject,
} from "../hooks/hookTrust.js";
import type { ProjectHookFile } from "../hooks/hookTrust.js";

export interface HooksCommandOptions {
  /** Skip the question; for scripts. */
  yes?: boolean;
}

function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function describe(cwd: string, files: ProjectHookFile[]): void {
  out(`Project hooks in ${cwd}:`);
  for (const file of files) out(`  ${file.path}`);
  out();
  for (const line of listProjectHandlers(files)) out(`  ${line}`);
  out();
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(question);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/** Returns the process exit code. */
export async function hooksCommand(
  action: string | undefined,
  options: HooksCommandOptions = {},
  cwd: string = process.cwd(),
): Promise<number> {
  const files = getProjectHookFiles(cwd);
  const fingerprint = fingerprintProjectHooks(cwd, files);

  switch (action ?? "list") {
    case "list": {
      if (files.length === 0) {
        out("This project defines no hooks.");
        return 0;
      }
      describe(cwd, files);
      out(
        isProjectTrusted(cwd, fingerprint)
          ? "Trusted: these hooks run."
          : "Not trusted: these hooks do not run. Review them, then run `continuous hooks trust`.",
      );
      return 0;
    }

    case "trust": {
      if (files.length === 0) {
        out("This project defines no hooks, so there is nothing to trust.");
        return 0;
      }
      describe(cwd, files);
      out("Each of these is a command that runs on your machine.");
      if (!options.yes) {
        if (!(await confirm("Trust them? [y/N] "))) {
          out(
            process.stdin.isTTY
              ? "Not trusted."
              : "Not trusted. There is no terminal to ask on; review the list above and pass --yes to trust it.",
          );
          return 1;
        }
      }
      try {
        trustProject(cwd, fingerprint);
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.message : String(error)}\n`,
        );
        return 1;
      }
      out("Trusted. Changing these hooks will ask again.");
      return 0;
    }

    case "revoke": {
      out(
        revokeProject(cwd)
          ? "Trust removed. This project's hooks no longer run."
          : "This project was not trusted.",
      );
      return 0;
    }

    default:
      process.stderr.write(
        `Unknown action '${action}'. Use list, trust or revoke.\n`,
      );
      return 1;
  }
}

/** Whether the project's hooks are being held back; used by the start-up notice. */
export function untrustedProjectHooks(cwd: string = process.cwd()) {
  return loadHooksConfig(cwd).untrustedProject;
}
