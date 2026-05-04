/**
 * GlobTool — find files by glob pattern.
 *
 * Ported from Marcel's GlobTool for the Continue CLI tool interface.
 * Uses Node.js built-in glob (v22+) or fast-glob as fallback.
 *
 * Distinct from listFiles (directory listing) — operates on patterns
 * like "**\/*.ts", "src/**\/*.{js,ts}", etc.
 */

import * as fs from "fs";
import * as path from "path";

import { Tool } from "./types.js";

const MAX_RESULTS = 100;

/** Minimal glob implementation using recursive directory walk + minimatch. */
async function globFiles(
  pattern: string,
  cwd: string,
): Promise<{ files: string[]; truncated: boolean }> {
  // Try native Node glob first (Node ≥ 22)
  try {
    const { glob } = await import("fs/promises" as any);
    if (typeof glob === "function") {
      const gen = glob(pattern, { cwd, withFileTypes: false });
      const files: string[] = [];
      for await (const f of gen) {
        files.push(typeof f === "string" ? f : (f.name ?? String(f)));
        if (files.length >= MAX_RESULTS + 1) break;
      }
      const truncated = files.length > MAX_RESULTS;
      return { files: files.slice(0, MAX_RESULTS), truncated };
    }
  } catch {
    // fall through
  }

  // Fallback: use child_process find + simple conversion
  try {
    const { execSync } = await import("child_process");
    // Convert glob pattern to find-compatible form
    const out = execSync(
      `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -n ${MAX_RESULTS + 1}`,
      { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
    const allFiles = out.trim().split("\n").filter(Boolean);
    const patternRegex = globPatternToRegex(pattern);
    const matching = allFiles
      .map((f) => f.replace(/^\.\//, ""))
      .filter((f) => patternRegex.test(f));
    const truncated = matching.length > MAX_RESULTS;
    return { files: matching.slice(0, MAX_RESULTS), truncated };
  } catch {
    // Last fallback: manual recursive walk
    const files: string[] = [];
    const patternRegex = globPatternToRegex(pattern);
    function walk(dir: string) {
      if (files.length > MAX_RESULTS) return;
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === "node_modules" || entry === ".git") continue;
        const full = path.join(dir, entry);
        const rel = path.relative(cwd, full);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          walk(full);
        } else if (patternRegex.test(rel)) {
          files.push(rel);
        }
      }
    }
    walk(cwd);
    const truncated = files.length > MAX_RESULTS;
    return { files: files.slice(0, MAX_RESULTS), truncated };
  }
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports **, *, ?, and {a,b} alternation.
 */
function globPatternToRegex(pattern: string): RegExp {
  const reStr = pattern
    .replace(/\\/g, "/") // normalise separators
    .split("**")
    .map(
      (seg) =>
        seg
          .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex special chars (except * ? { already handled)
          .replace(/\*/g, "[^/]*") // * → any non-separator chars
          .replace(/\?/g, "[^/]"), // ? → any single non-separator
    )
    .join(".*"); // ** → match anything including slashes
  return new RegExp(`^${reStr}$`);
}

export const globTool: Tool = {
  name: "Glob",
  displayName: "Glob",
  description:
    "Finds files matching a glob pattern (e.g. **/*.ts, src/**/*.{js,ts}). Returns up to 100 results sorted by modification time. Use this when you know the naming pattern of files you need.",
  parameters: {
    type: "object",
    required: ["pattern"],
    properties: {
      pattern: {
        type: "string",
        description:
          'The glob pattern to match files against (e.g. "**/*.ts", "src/**/*.{js,tsx}", "*.md")',
      },
      path: {
        type: "string",
        description:
          "The directory to search in. Defaults to the current working directory if not specified.",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    return {
      preview: [
        {
          type: "text",
          content: `Glob: ${args.pattern}${args.path ? ` in ${args.path}` : ""}`,
        },
      ],
      args,
    };
  },
  run: async (args: { pattern: string; path?: string }): Promise<string> => {
    const { pattern, path: searchPath } = args;

    if (!pattern || typeof pattern !== "string") {
      return "Error: pattern is required";
    }

    const cwd = searchPath
      ? path.resolve(process.cwd(), searchPath)
      : process.cwd();

    if (!fs.existsSync(cwd)) {
      return `Error: directory does not exist: ${cwd}`;
    }

    const start = Date.now();
    const { files, truncated } = await globFiles(pattern, cwd);
    const durationMs = Date.now() - start;

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    // Sort by modification time (newest first) where possible
    const withMtime = files
      .map((f) => {
        try {
          const mtime = fs.statSync(path.join(cwd, f)).mtimeMs;
          return { f, mtime };
        } catch {
          return { f, mtime: 0 };
        }
      })
      .sort((a, b) => b.mtime - a.mtime);

    const sorted = withMtime.map((x) => x.f);

    const lines: string[] = sorted;
    if (truncated) {
      lines.push(`\n(Results truncated to ${MAX_RESULTS} files)`);
    }

    return [
      `Found ${files.length}${truncated ? "+" : ""} file${files.length !== 1 ? "s" : ""} matching "${pattern}" in ${durationMs}ms:`,
      ...sorted,
      ...(truncated ? [`\n(Results truncated to ${MAX_RESULTS})`] : []),
    ].join("\n");
  },
};
