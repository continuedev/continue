import chalk from "chalk";

export interface CheckResult {
  /** Agent slug or local path */
  agent: string;
  /** Display name */
  name: string;
  /** "pass" if no changes suggested, "fail" if changes suggested, "error" if agent errored */
  status: "pass" | "fail" | "error";
  /** Unified diff patch of agent's suggested changes */
  patch: string;
  /** Agent's text output (explanation/rationale) */
  output: string;
  /** Duration in seconds */
  duration: number;
  /** Error message if status is "error" */
  error?: string;
}

export interface RenderOptions {
  baseBranch: string;
  changedFileCount: number;
  format: "text" | "json";
  checksFromHub: boolean;
}

/**
 * Render the check results report.
 */
export function renderReport(
  results: CheckResult[],
  options: RenderOptions,
): string {
  if (options.format === "json") {
    return renderJsonReport(results, options);
  }
  return renderTextReport(results, options);
}

function renderJsonReport(
  results: CheckResult[],
  _options: RenderOptions,
): string {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const errored = results.filter((r) => r.status === "error").length;

  return JSON.stringify(
    {
      checks: results.map((r) => ({
        agent: r.agent,
        name: r.name,
        status: r.status,
        patch: r.patch,
        output: r.output,
        duration: r.duration,
        ...(r.error ? { error: r.error } : {}),
      })),
      summary: {
        total: results.length,
        passed,
        failed,
        errored,
      },
    },
    null,
    2,
  );
}

function renderTextReport(
  results: CheckResult[],
  options: RenderOptions,
): string {
  const isTTY = process.stdout.isTTY;
  const lines: string[] = [];

  lines.push(isTTY ? chalk.bold("# Check Results") : "# Check Results");
  lines.push("");
  lines.push(
    `Checked against \`${options.baseBranch}...HEAD\` (${options.changedFileCount} files changed)`,
  );
  lines.push("");

  for (const result of results) {
    const durationStr = `(${result.duration.toFixed(1)}s)`;

    if (result.status === "pass") {
      const header = isTTY
        ? chalk.green(`## ✓ ${result.name}`) + " " + chalk.dim(durationStr)
        : `## ✓ ${result.name} ${durationStr}`;
      lines.push(header);
      lines.push("No issues found.");
    } else if (result.status === "error") {
      const header = isTTY
        ? chalk.red(`## ✗ ${result.name}`) + " " + chalk.dim(durationStr)
        : `## ✗ ${result.name} ${durationStr}`;
      lines.push(header);
      lines.push(`Error: ${result.error || "Unknown error"}`);
    } else {
      const header = isTTY
        ? chalk.red(`## ✗ ${result.name}`) + " " + chalk.dim(durationStr)
        : `## ✗ ${result.name} ${durationStr}`;
      lines.push(header);
      lines.push("");

      if (result.output.trim()) {
        lines.push(result.output.trim());
        lines.push("");
      }

      if (result.patch.trim()) {
        lines.push("### Suggested changes:");
        lines.push("```diff");
        lines.push(result.patch.trim());
        lines.push("```");
      }
    }

    lines.push("");
  }

  // Summary
  lines.push("---");
  const failed = results.filter(
    (r) => r.status === "fail" || r.status === "error",
  ).length;
  const total = results.length;

  if (failed === 0) {
    const summary = `**All ${total} checks passed.**`;
    lines.push(isTTY ? chalk.green(summary) : summary);
  } else {
    const summary = `**${failed} of ${total} checks failed.**`;
    lines.push(isTTY ? chalk.red(summary) : summary);
  }

  // Migration nudge
  lines.push("");
  if (options.checksFromHub) {
    lines.push(
      isTTY
        ? chalk.dim("These checks also run on your PRs via Continue CI.")
        : "These checks also run on your PRs via Continue CI.",
    );
  } else {
    lines.push(
      isTTY
        ? chalk.dim(
            "Tip: Run these automatically on every PR → https://hub.continue.dev",
          )
        : "Tip: Run these automatically on every PR → https://hub.continue.dev",
    );
  }

  return lines.join("\n");
}
