import { execFile } from "child_process";
import { promisify } from "util";

import { checkIfRipgrepIsInstalled, searchCodeTool } from "./searchCode.js";
import { Tool } from "./types.js";

const execFileAsync = promisify(execFile);

function paginateLines(
  content: string,
  limit: number | undefined,
  offset: number | undefined,
): string[] {
  const lines = content.split("\n").filter(Boolean);
  const start = Math.max(0, offset ?? 0);
  if (limit === 0) {
    return lines.slice(start);
  }
  const effectiveLimit = limit ?? 250;
  return lines.slice(start, start + effectiveLimit);
}

export const grepTool: Tool = {
  name: "Grep",
  displayName: "Grep",
  description:
    "Search file contents with ripgrep using regex, optional globs, and multiple output modes.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["pattern"],
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for.",
      },
      path: {
        type: "string",
        description:
          "Path to search from. Defaults to current working directory.",
      },
      glob: {
        type: "string",
        description: "Optional rg --glob filter such as *.ts or src/**.",
      },
      output_mode: {
        type: "string",
        description:
          'One of "content", "files_with_matches", or "count". Defaults to "content".',
      },
      case_insensitive: {
        type: "boolean",
        description: "Set true to perform a case-insensitive search.",
      },
      line_numbers: {
        type: "boolean",
        description: "Set true to include line numbers. Defaults to true.",
      },
      context: {
        type: "number",
        description: "Number of context lines before and after each match.",
      },
      head_limit: {
        type: "number",
        description:
          "Maximum number of output lines to return. Use 0 for no limit.",
      },
      offset: {
        type: "number",
        description: "Number of output lines to skip before returning results.",
      },
      multiline: {
        type: "boolean",
        description: "Enable multiline regex mode.",
      },
    },
  },
  run: async (args: {
    pattern: string;
    path?: string;
    glob?: string;
    output_mode?: "content" | "files_with_matches" | "count";
    case_insensitive?: boolean;
    line_numbers?: boolean;
    context?: number;
    head_limit?: number;
    offset?: number;
    multiline?: boolean;
  }): Promise<string> => {
    if (!(await checkIfRipgrepIsInstalled())) {
      return searchCodeTool.run({
        pattern: args.pattern,
        path: args.path,
        file_pattern: args.glob,
      });
    }

    const mode = args.output_mode ?? "content";
    const rgArgs: string[] = [];

    if (mode === "files_with_matches") {
      rgArgs.push("--files-with-matches");
    } else if (mode === "count") {
      rgArgs.push("--count");
    } else {
      rgArgs.push("--with-filename");
      if (args.line_numbers !== false) {
        rgArgs.push("--line-number");
      }
      if (typeof args.context === "number" && args.context > 0) {
        rgArgs.push("-C", String(args.context));
      }
    }

    rgArgs.push("--color", "never");

    if (args.case_insensitive) {
      rgArgs.push("-i");
    }

    if (args.glob) {
      rgArgs.push("--glob", args.glob);
    }

    if (args.multiline) {
      rgArgs.push("-U", "--multiline-dotall");
    }

    rgArgs.push(args.pattern, args.path ?? process.cwd());

    try {
      const { stdout } = await execFileAsync("rg", rgArgs, {
        cwd: args.path ?? process.cwd(),
        maxBuffer: 4 * 1024 * 1024,
      });

      const paginated = paginateLines(stdout, args.head_limit, args.offset);
      if (paginated.length === 0) {
        return `No matches found for pattern "${args.pattern}".`;
      }

      return paginated.join("\n");
    } catch (error: any) {
      if (typeof error?.code === "number" && error.code === 1) {
        return `No matches found for pattern "${args.pattern}".`;
      }

      const stderr =
        typeof error?.stderr === "string" ? error.stderr.trim() : "";
      throw new Error(
        stderr || `Failed to run grep search for "${args.pattern}"`,
      );
    }
  },
};
