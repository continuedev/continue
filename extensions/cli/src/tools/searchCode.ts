import * as child_process from "child_process";
import * as fs from "fs";
import * as util from "util";

import { Tool } from "./types.js";

const execPromise = util.promisify(child_process.exec);

// Default maximum number of results to display
const DEFAULT_MAX_RESULTS = 100;

export const searchCodeTool: Tool = {
  name: "Search",
  displayName: "Search",
  description: "Search the codebase using ripgrep (rg) for a specific pattern",
  parameters: {
    type: "object",
    required: ["pattern"],
    properties: {
      pattern: {
        type: "string",
        description: "The search pattern to look for",
      },
      path: {
        type: "string",
        description: "The path to search in (defaults to current directory)",
      },
      file_pattern: {
        type: "string",
        description: "Optional file pattern to filter results (e.g., '*.ts')",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  preprocess: async (args) => {
    const truncatedPattern =
      args.pattern.length > 50
        ? args.pattern.substring(0, 50) + "..."
        : args.pattern;
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will search for: "${truncatedPattern}"`,
        },
      ],
    };
  },
  run: async (args: {
    pattern: string;
    path?: string;
    file_pattern?: string;
  }): Promise<string> => {
    try {
      const searchPath = args.path || process.cwd();
      if (!fs.existsSync(searchPath)) {
        return `Error: Path does not exist: ${searchPath}`;
      }

      let command = `rg --line-number --with-filename --color never "${args.pattern}"`;

      if (args.file_pattern) {
        command += ` -g "${args.file_pattern}"`;
      }

      command += ` "${searchPath}"`;
      try {
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
          return `Warning during search: ${stderr}\n\n${stdout}`;
        }

        if (!stdout.trim()) {
          return `No matches found for pattern "${args.pattern}"${
            args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
          }.`;
        }

        // Split the results into lines and limit the number of results
        const lines = stdout.split("\n");
        const truncated = lines.length > DEFAULT_MAX_RESULTS;
        const limitedLines = lines.slice(0, DEFAULT_MAX_RESULTS);
        const resultText = limitedLines.join("\n");

        const truncationMessage = truncated
          ? `\n\n[Results truncated: showing ${DEFAULT_MAX_RESULTS} of ${lines.length} matches]`
          : "";

        return `Search results for pattern "${args.pattern}"${
          args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
        }:\n\n${resultText}${truncationMessage}`;
      } catch (error: any) {
        if (error.code === 1) {
          return `No matches found for pattern "${args.pattern}"${
            args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
          }.`;
        }
        if (error instanceof Error) {
          if (error.message.includes("command not found")) {
            return `Error: ripgrep is not installed.`;
          }
        }
        return `Error executing ripgrep: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    } catch (error) {
      return `Error searching code: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  },
};
