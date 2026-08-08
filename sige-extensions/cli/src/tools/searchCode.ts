import * as child_process from "child_process";
import * as fs from "fs";
import * as util from "util";

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { findUp } from "find-up";

import { parseEnvNumber } from "../util/truncateOutput.js";

import { Tool } from "./types.js";

const execPromise = util.promisify(child_process.exec);

async function getGitignorePatterns() {
  const gitIgnorePath = await findUp(".gitignore");
  if (!gitIgnorePath) return [];
  const content = fs.readFileSync(gitIgnorePath, "utf-8");
  const ignorePatterns = [];
  for (let line of content.trim().split("\n")) {
    line = line.trim();
    if (line.startsWith("#") || line === "") continue; // ignore comments and empty line
    if (line.startsWith("!")) continue; // ignore negated ignores
    ignorePatterns.push(line);
  }
  return ignorePatterns;
}

// procedure 1: search with ripgrep
export async function checkIfRipgrepIsInstalled(): Promise<boolean> {
  try {
    await execPromise("rg --version");
    return true;
  } catch {
    return false;
  }
}

async function searchWithRipgrep(
  pattern: string,
  searchPath: string,
  filePattern?: string,
) {
  let command = `rg --line-number --with-filename --color never "${pattern}"`;

  if (filePattern) {
    command += ` -g "${filePattern}"`;
  }

  const ignorePatterns = await getGitignorePatterns();
  for (const ignorePattern of ignorePatterns) {
    command += ` -g "!${ignorePattern}"`;
  }

  command += ` "${searchPath}"`;
  const { stdout, stderr } = await execPromise(command);
  return { stdout, stderr };
}

// procedure 2: search with grep on unix or findstr on windows
async function searchWithGrepOrFindstr(
  pattern: string,
  searchPath: string,
  filePattern?: string,
) {
  const isWindows = process.platform === "win32";
  const ignorePatterns = await getGitignorePatterns();
  let command: string;
  if (isWindows) {
    const fileSpec = filePattern ? filePattern : "*";
    command = `findstr /S /N /P /R "${pattern}" "${fileSpec}"`; // findstr does not support ignoring patterns
  } else {
    let excludeArgs = "";
    for (const ignorePattern of ignorePatterns) {
      excludeArgs += ` --exclude="${ignorePattern}" --exclude-dir="${ignorePattern}"`; // use both exclude and exclude-dir because ignorePattern can be a file or directory
    }
    if (filePattern) {
      command = `find . -type f -path "${filePattern}" -print0 | xargs -0 grep -nH -I${excludeArgs} "${pattern}"`;
    } else {
      command = `grep -R -n -H -I${excludeArgs} "${pattern}" .`;
    }
  }
  return await execPromise(command, { cwd: searchPath });
}

// Output truncation defaults
const DEFAULT_SEARCH_MAX_RESULTS = 100;
const DEFAULT_SEARCH_MAX_RESULT_CHARS = 1000; // Max chars per result line

function getSearchMaxResults(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_SEARCH_CODE_MAX_RESULTS,
    DEFAULT_SEARCH_MAX_RESULTS,
  );
}

function getSearchMaxResultChars(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_SEARCH_CODE_MAX_RESULT_CHARS,
    DEFAULT_SEARCH_MAX_RESULT_CHARS,
  );
}

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
    const searchPath = args.path || process.cwd();
    if (!fs.existsSync(searchPath)) {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `Path does not exist: ${searchPath}`,
      );
    }

    let stdout = "",
      stderr = "";
    try {
      if (await checkIfRipgrepIsInstalled()) {
        const results = await searchWithRipgrep(
          args.pattern,
          searchPath,
          args.file_pattern,
        );
        stdout = results.stdout;
        stderr = results.stderr;
      } else {
        const results = await searchWithGrepOrFindstr(
          args.pattern,
          searchPath,
          args.file_pattern,
        );
        stdout = results.stdout;
        stderr = results.stderr;
      }

      if (stderr) {
        return `Warning during search: ${stderr}\n\n${stdout}`;
      }

      if (!stdout.trim()) {
        return `No matches found for pattern "${args.pattern}"${
          args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
        }.`;
      }

      // Split the results into lines and limit the number of results
      const maxResults = getSearchMaxResults();
      const maxResultChars = getSearchMaxResultChars();

      const splitLines = stdout.split("\n");
      const lines = splitLines.filter((line) => line.length <= maxResultChars);
      if (lines.length === 0) {
        return `No matches found for pattern "${args.pattern}"${
          args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
        }.`;
      }
      const truncated = lines.length > maxResults;
      const limitedLines = lines.slice(0, maxResults);
      const resultText = limitedLines.join("\n");

      const truncationMessage = truncated
        ? `\n\n[Results truncated: showing ${maxResults} of ${lines.length} matches]`
        : "";

      return `Search results for pattern "${args.pattern}"${
        args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
      }:\n\n${resultText}${truncationMessage}`;
    } catch (error: any) {
      if (error instanceof ContinueError) {
        throw error;
      }
      if (error.code === 1) {
        return `No matches found for pattern "${args.pattern}"${
          args.file_pattern ? ` in files matching "${args.file_pattern}"` : ""
        }.`;
      }
      throw new Error(
        `Error executing search: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};
