import { execSync, fork } from "child_process";

import chalk from "chalk";
import React from "react";

import { configureConsoleForHeadless } from "../init.js";
import { logger } from "../util/logger.js";

import { ExtendedCommandOptions } from "./BaseCommandOptions.js";
import type { ReviewState } from "./review/ReviewProgress.js";
import { ReviewProgress } from "./review/ReviewProgress.js";
import type { WorkerConfig, WorkerResult } from "./review/reviewWorker.js";
import type { DiffContext } from "./review/diffContext.js";
import { computeDiffContext } from "./review/diffContext.js";
import type { ReviewResult } from "./review/renderReport.js";
import { renderReport } from "./review/renderReport.js";
import { resolveReviews } from "./review/resolveReviews.js";
import { createWorktree, cleanupWorktree } from "./review/worktree.js";

export interface ReviewOptions extends ExtendedCommandOptions {
  base?: string;
  format?: string;
  fix?: boolean;
  patch?: boolean;
  failFast?: boolean;
  reviewAgents?: string[];
}

/**
 * Run a single review in a forked worker process.
 */
async function runReviewInWorker(
  agentSource: string,
  worktreePath: string,
  diffContext: DiffContext,
  options: ReviewOptions,
): Promise<WorkerResult> {
  return new Promise<WorkerResult>((resolve, _reject) => {
    // Fork the current CLI entry point with the internal worker flag
    const workerPath = process.argv[1];
    const child = fork(workerPath, ["--internal-review-worker"], {
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
            error: "Review timed out after 5 minutes",
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
        child.send({ type: "run-review", config });
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
function applyPatches(results: ReviewResult[]): void {
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
 * Mutable props bag for the live Ink UI so we can update it progressively.
 */
interface LiveUIProps {
  checks: ReviewState[];
  baseBranch?: string;
  changedFileCount?: number;
  loading?: boolean;
}

/**
 * Mount the Ink live progress UI or return a no-op for non-TTY / special modes.
 */
async function mountProgressUI(
  props: LiveUIProps,
  options: ReviewOptions,
): Promise<{ rerender: () => void; unmount: () => void }> {
  const useLiveUI =
    process.stdout.isTTY && !options.patch && options.format !== "json";

  if (!useLiveUI) {
    return {
      rerender: () => {},
      unmount: () => {},
    };
  }

  const { render } = await import("ink");
  const instance = render(React.createElement(ReviewProgress, props));
  return {
    rerender: () =>
      instance.rerender(React.createElement(ReviewProgress, props)),
    unmount: () => instance.unmount(),
  };
}

/**
 * Output results and exit with appropriate code.
 */
function outputResultsAndExit(
  results: ReviewResult[],
  diffContext: DiffContext,
  options: ReviewOptions,
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
 * Main review command handler.
 */
export async function review(options: ReviewOptions = {}): Promise<void> {
  configureConsoleForHeadless(false);

  if (options.verbose) {
    logger.setLevel("debug");
  }

  // Mount the live UI immediately with a loading state
  const uiProps: LiveUIProps = {
    checks: [],
    loading: true,
  };
  const { rerender, unmount: unmountUI } = await mountProgressUI(
    uiProps,
    options,
  );

  // Step 1: Compute diff
  const diffContext = computeDiffContext(options.base);

  if (!diffContext.diff.trim() && diffContext.changedFiles.length === 0) {
    unmountUI();
    console.log(
      chalk.yellow(
        "No changes detected. Make some changes or specify a different base branch with --base.",
      ),
    );
    process.exit(0);
  }

  // Update UI with diff info (still loading reviews)
  uiProps.baseBranch = diffContext.baseBranch;
  uiProps.changedFileCount = diffContext.changedFiles.length;
  rerender();

  // Step 2: Resolve reviews
  const reviews = await resolveReviews(options.reviewAgents);

  if (reviews.length === 0) {
    unmountUI();
    console.log(
      chalk.yellow("\nNo reviews found. To add reviews:\n") +
        chalk.dim(
          "  1. Create .continue/agents/my-review.md with agent instructions\n",
        ) +
        chalk.dim(
          "  2. Or specify an agent: cn review --review-agents org/agent-name\n",
        ) +
        chalk.dim("  3. Or configure reviews on https://continue.dev\n"),
    );
    process.exit(0);
  }

  const checksFromHub = reviews.some((c) => c.sourceType === "hub");

  // Build mutable state for the live UI and stop loading
  const reviewStates: ReviewState[] = reviews.map((c) => ({
    name: c.name,
    status: "pending" as const,
  }));
  uiProps.checks = reviewStates;
  uiProps.loading = false;
  rerender();

  // Step 3: Create worktrees and run reviews
  const results: ReviewResult[] = [];

  const runSingleReview = async (
    resolvedReview: (typeof reviews)[number],
    i: number,
  ): Promise<ReviewResult> => {
    const startTime = Date.now();
    let worktreePath: string | null = null;

    try {
      // Mark as running
      reviewStates[i].status = "running";
      reviewStates[i].startTime = Date.now();
      rerender();

      worktreePath = await createWorktree(i);

      const workerResult = await runReviewInWorker(
        resolvedReview.source,
        worktreePath,
        diffContext,
        options,
      );

      const status = workerResult.error
        ? ("error" as const)
        : workerResult.patch.trim()
          ? ("fail" as const)
          : ("pass" as const);

      const duration = (Date.now() - startTime) / 1000;

      // Mark as complete
      reviewStates[i].status = status;
      reviewStates[i].duration = duration;
      rerender();

      return {
        agent: resolvedReview.source,
        name: resolvedReview.name,
        status,
        patch: workerResult.patch,
        output: workerResult.agentOutput,
        duration,
        error: workerResult.error,
      };
    } catch (e: any) {
      const duration = (Date.now() - startTime) / 1000;

      // Mark as error
      reviewStates[i].status = "error";
      reviewStates[i].duration = duration;
      rerender();

      return {
        agent: resolvedReview.source,
        name: resolvedReview.name,
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
    for (let i = 0; i < reviews.length; i++) {
      const result = await runSingleReview(reviews[i], i);
      results.push(result);
      if (result.status === "fail" || result.status === "error") {
        break;
      }
    }
  } else {
    const settled = await Promise.allSettled(
      reviews.map((resolvedReview, i) => runSingleReview(resolvedReview, i)),
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  unmountUI();
  outputResultsAndExit(results, diffContext, options, checksFromHub);
}
