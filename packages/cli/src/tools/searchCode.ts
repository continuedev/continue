import * as child_process from "child_process";
import * as fs from "fs";
import * as util from "util";
import { Tool } from "./types.js";

const execPromise = util.promisify(child_process.exec);

export const searchCodeTool: Tool = {
  name: "search_code",
  description: "Search the codebase using ripgrep (rg) for a specific pattern",
  parameters: {
    pattern: {
      type: "string",
      description: "The search pattern to look for",
      required: true,
    },
    path: {
      type: "string",
      description: "The path to search in (defaults to current directory)",
      required: false,
    },
    file_pattern: {
      type: "string",
      description: "Optional file pattern to filter results (e.g., '*.ts')",
      required: false,
    },
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
          return `No matches found for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}.`;
        }

        return `Search results for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}:\n\n${stdout}`;
      } catch (error: any) {
        if (error.code === 1) {
          return `No matches found for pattern "${args.pattern}"${args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""}.`;
        }

        return `Error executing ripgrep: ${error instanceof Error ? error.message : String(error)}`;
      }
    } catch (error) {
      return `Error searching code: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
