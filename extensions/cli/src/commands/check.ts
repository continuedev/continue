import { execSync, fork } from "child_process";

import chalk from "chalk";
import React from "react";

import { configureConsoleForHeadless } from "../init.js";
import { logger } from "../util/logger.js";

import { ExtendedCommandOptions } from "./BaseCommandOptions.js";
import type { CheckState } from "./check/CheckProgress.js";
import { CheckProgress } from "./check/CheckProgress.js";
import type { WorkerConfig, WorkerResult } from "./check/checkWorker.js";
import type { DiffContext } from "./check/diffContext.js";
import { computeDiffContext } from "./check/diffContext.js";
import type { CheckResult } from "./check/renderReport.js";
import { renderReport } from "./check/renderReport.js";
import { resolveChecks } from "./check/resolveChecks.js";
import { createWorktree, cleanupWorktree } from "./check/worktree.js";

export interface CheckOptions extends ExtendedCommandOptions {
  base?: string;
  format?: string;
  fix?: boolean;
  patch?: boolean;
  failFast?: boolean;
  checkAgents?: string[];
}

/**
 * Run a single check in a forked worker process.
 */
async function runCheckInWorker(
  agentSource: string,
  worktreePath: string,
  diffContext: DiffContext,
  options: CheckOptions,
): Promise<WorkerResult> {
  return new Promise<WorkerResult>((resolve, _reject) => {
    // Fork the current CLI entry point with the internal worker flag
    const workerPath = process.argv[1];
    const child = fork(workerPath, ["--internal-check-worker"], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      env: {
        ...process.env,
        // Ensure the worker can find its config
        NODE_OPTIONS: process.env.NODE_OPTIONS || "",
      },
    });

    let settled = false;

    const timeout = setTimeout(
      () => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          resolve({
            patch: "",
            agentOutput: "",
            duration: 0,
            error: "Check timed out after 5 minutes",
          });
        }
      },
      5 * 60 * 1000,
    ); // 5 minute timeout

    child.on("message", (msg: { type: string; result?: WorkerResult }) => {
      if (msg.type === "ready") {
        // Worker is ready, send the config
        const config: WorkerConfig = {
          agentSource,
          worktreePath,
          diffContext,
          options: {
            config: options.config,
            org: options.org,
            rule: options.rule,
            verbose: options.verbose,
          },
        };
        child.send({ type: "run-check", config });
      } else if (msg.type === "result" && msg.result) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(msg.result);
        }
      }
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          patch: "",
          agentOutput: "",
          duration: 0,
          error: err.message,
        });
      }
    });

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          resolve({
            patch: "",
            agentOutput: "",
            duration: 0,
            error: `Worker exited with code ${code}`,
          });
        }
      }
    });

    // Capture stderr for debugging
    if (child.stderr) {
      let stderr = "";
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      child.on("exit", () => {
        if (stderr.trim()) {
          logger.debug("Worker stderr:", { stderr: stderr.trim() });
        }
      });
    }
  });
}

/**
 * Apply patches to the real working tree (--fix mode).
 */
function applyPatches(results: CheckResult[]): void {
  const patchResults = results.filter(
    (r) => r.status === "fail" && r.patch.trim(),
  );

  if (patchResults.length === 0) {
    console.log(chalk.dim("No patches to apply."));
    return;
  }

  let applied = 0;
  let failed = 0;

  for (const result of patchResults) {
    try {
      // Dry-run first
      execSync("git apply --check -", {
        input: result.patch,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Actually apply
      execSync("git apply -", {
        input: result.patch,
        stdio: ["pipe", "pipe", "pipe"],
      });
      applied++;
      console.log(chalk.green(`  ✓ Applied patch from ${result.name}`));
    } catch {
      failed++;
      console.log(
        chalk.red(
          `  ✗ Could not apply patch from ${result.name} (conflict with working tree)`,
        ),
      );
    }
  }

  console.log(
    `\nApplied ${applied}/${patchResults.length} patches.` +
      (failed > 0 ? ` ${failed} had conflicts (see above).` : ""),
  );
}

/**
 * Mount the Ink live progress UI or fall back to static logs.
 */
async function mountProgressUI(
  checkStates: CheckState[],
  diffContext: DiffContext,
  options: CheckOptions,
): Promise<{ rerender?: () => void; unmount?: () => void }> {
  const useLiveUI =
    process.stdout.isTTY && !options.patch && options.format !== "json";

  if (!useLiveUI) {
    console.log(
      chalk.dim(
        `Running ${checkStates.length} check${checkStates.length > 1 ? "s" : ""}: ${checkStates.map((c) => c.name).join(", ")}`,
      ),
    );
    return {};
  }

  const { render } = await import("ink");
  const props = {
    checks: checkStates,
    baseBranch: diffContext.baseBranch,
    changedFileCount: diffContext.changedFiles.length,
  };
  const instance = render(React.createElement(CheckProgress, props));
  return {
    rerender: () =>
      instance.rerender(React.createElement(CheckProgress, props)),
    unmount: () => instance.unmount(),
  };
}

/**
 * Output results and exit with appropriate code.
 */
function outputResultsAndExit(
  results: CheckResult[],
  diffContext: DiffContext,
  options: CheckOptions,
  checksFromHub: boolean,
): void {
  const format = options.format === "json" ? "json" : "text";
  const report = renderReport(results, {
    baseBranch: diffContext.baseBranch,
    changedFileCount: diffContext.changedFiles.length,
    format,
    checksFromHub,
  });

  if (options.patch) {
    const allPatches = results
      .filter((r) => r.patch.trim())
      .map((r) => r.patch)
      .join("\n");
    process.stdout.write(allPatches);
    process.exit(
      results.some((r) => r.status === "fail" || r.status === "error") ? 1 : 0,
    );
  }

  console.log("\n" + report);

  if (options.fix) {
    console.log(chalk.dim("\nApplying fixes..."));
    applyPatches(results);
  }

  const hasFailed = results.some(
    (r) => r.status === "fail" || r.status === "error",
  );
  process.exit(hasFailed ? 1 : 0);
}

/**
 * Main check command handler.
 */
export async function check(options: CheckOptions = {}): Promise<void> {
  configureConsoleForHeadless(false);

  if (options.verbose) {
    logger.setLevel("debug");
  }

  // Step 1: Check for changes
  console.log(chalk.dim("Computing diff..."));
  const diffContext = computeDiffContext(options.base);

  if (!diffContext.diff.trim() && diffContext.changedFiles.length === 0) {
    console.log(
      chalk.yellow(
        "No changes detected. Make some changes or specify a different base branch with --base.",
      ),
    );
    process.exit(0);
  }

  console.log(
    chalk.dim(
      `Found ${diffContext.changedFiles.length} changed files against ${diffContext.baseBranch}`,
    ),
  );

  // Step 2: Resolve checks
  console.log(chalk.dim("Resolving checks..."));
  const checks = await resolveChecks(options.checkAgents);

  if (checks.length === 0) {
    console.log(
      chalk.yellow("\nNo checks found. To add checks:\n") +
        chalk.dim(
          "  1. Create .continue/agents/my-check.md with agent instructions\n",
        ) +
        chalk.dim(
          "  2. Or specify an agent: cn check --agent org/agent-name\n",
        ) +
        chalk.dim("  3. Or configure checks on https://hub.continue.dev\n"),
    );
    process.exit(0);
  }

  const checksFromHub = checks.some((c) => c.sourceType === "hub");

  // Build mutable state for the live UI
  const checkStates: CheckState[] = checks.map((c) => ({
    name: c.name,
    status: "pending" as const,
  }));

  const { rerender, unmount: unmountUI } = await mountProgressUI(
    checkStates,
    diffContext,
    options,
  );

  // Step 3: Create worktrees and run checks
  const results: CheckResult[] = [];

  const runSingleCheck = async (
    resolvedCheck: (typeof checks)[number],
    i: number,
  ): Promise<CheckResult> => {
    const startTime = Date.now();
    let worktreePath: string | null = null;

    try {
      // Mark as running
      checkStates[i].status = "running";
      checkStates[i].startTime = Date.now();
      rerender?.();

      worktreePath = await createWorktree(i);

      const workerResult = await runCheckInWorker(
        resolvedCheck.source,
        worktreePath,
        diffContext,
        options,
      );

      const status = workerResult.error
        ? ("error" as const)
        : workerResult.patch.trim()
          ? ("fail" as const)
          : ("pass" as const);

      // Mark as complete
      checkStates[i].status = status;
      checkStates[i].duration = workerResult.duration;
      rerender?.();

      return {
        agent: resolvedCheck.source,
        name: resolvedCheck.name,
        status,
        patch: workerResult.patch,
        output: workerResult.agentOutput,
        duration: workerResult.duration,
        error: workerResult.error,
      };
    } catch (e: any) {
      const duration = (Date.now() - startTime) / 1000;

      // Mark as error
      checkStates[i].status = "error";
      checkStates[i].duration = duration;
      rerender?.();

      return {
        agent: resolvedCheck.source,
        name: resolvedCheck.name,
        status: "error" as const,
        patch: "",
        output: "",
        duration,
        error: e.message || String(e),
      };
    } finally {
      if (worktreePath) {
        await cleanupWorktree(worktreePath);
      }
    }
  };

  if (options.failFast) {
    for (let i = 0; i < checks.length; i++) {
      const result = await runSingleCheck(checks[i], i);
      results.push(result);
      if (result.status === "fail" || result.status === "error") {
        break;
      }
    }
  } else {
    const settled = await Promise.allSettled(
      checks.map((resolvedCheck, i) => runSingleCheck(resolvedCheck, i)),
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  unmountUI?.();
  outputResultsAndExit(results, diffContext, options, checksFromHub);
}
