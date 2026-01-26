import { spawn } from "child_process";

import {
  evaluateTerminalCommandSecurity,
  type ToolPolicy,
} from "@continuedev/terminal-security";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  isGitCommitCommand,
  isPullRequestCommand,
} from "../telemetry/utils.js";
import {
  parseEnvNumber,
  truncateOutputFromStart,
} from "../util/truncateOutput.js";

import { Tool, ToolRunContext } from "./types.js";

// Output truncation defaults
const DEFAULT_BASH_MAX_CHARS = 50000; // ~12.5k tokens
const DEFAULT_BASH_MAX_LINES = 1000;

function getBashMaxChars(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_CHARS,
    DEFAULT_BASH_MAX_CHARS,
  );
}

function getBashMaxLines(): number {
  return parseEnvNumber(
    process.env.CONTINUE_CLI_BASH_MAX_OUTPUT_LINES,
    DEFAULT_BASH_MAX_LINES,
  );
}

// Helper function to use login shell on Unix/macOS and PowerShell on Windows
function getShellCommand(command: string): { shell: string; args: string[] } {
  if (process.platform === "win32") {
    // Windows: Use PowerShell
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", command],
    };
  } else {
    // Unix/macOS: Use login shell to source .bashrc/.zshrc etc.
    const userShell = process.env.SHELL || "/bin/bash";
    return { shell: userShell, args: ["-l", "-c", command] };
  }
}

export const runTerminalCommandTool: Tool = {
  name: "Bash",
  displayName: "Bash",
  description: `Executes a terminal command and returns the output

Commands are automatically executed from the current working directory (${process.cwd()}), so there's no need to change directories with 'cd' commands.

IMPORTANT: To edit files, use Edit/MultiEdit tools instead of bash commands (sed, awk, etc).
`,
  parameters: {
    type: "object",
    required: ["command"],
    properties: {
      command: {
        type: "string",
        description: "The command to execute in the terminal.",
      },
      timeout: {
        type: "number",
        description:
          "Optional timeout in seconds (max 600). Use this parameter for commands that take longer than the default 180 second timeout.",
      },
    },
  },
  readonly: false,
  isBuiltIn: true,
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
  ): ToolPolicy => {
    return evaluateTerminalCommandSecurity(
      basePolicy,
      parsedArgs.command as string,
    );
  },
  preprocess: async (args) => {
    const command = args.command;
    if (!command || typeof command !== "string") {
      throw new Error("command arg is required and must be a non-empty string");
    }
    const truncatedCmd =
      command.length > 60 ? command.substring(0, 60) + "..." : command;
    return {
      args,
      preview: [
        {
          type: "text",
          content: `Will run: ${truncatedCmd}`,
        },
      ],
    };
  },
  run: async (
    {
      command,
      timeout,
    }: {
      command: string;
      timeout?: number;
    },
    context?: ToolRunContext,
  ): Promise<string> => {
    // Divide limits by parallel tool call count to avoid context overflow
    const parallelCount = context?.parallelToolCallCount ?? 1;
    const baseMaxChars = getBashMaxChars();
    const baseMaxLines = getBashMaxLines();
    const maxChars = Math.floor(baseMaxChars / parallelCount);
    const maxLines = Math.floor(baseMaxLines / parallelCount);

    return new Promise((resolve, reject) => {
      // Use same shell logic as core implementation
      const { shell, args } = getShellCommand(command);
      const child = spawn(shell, args);
      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      // Determine timeout: use provided timeout (capped at 600s), test env variable, or default 120s
      let TIMEOUT_MS = 180000; // 180 seconds default
      if (timeout !== undefined) {
        // Cap at 600 seconds (10 minutes)
        const cappedTimeout = Math.min(timeout, 600);
        TIMEOUT_MS = cappedTimeout * 1000;
      } else if (
        process.env.NODE_ENV === "test" &&
        process.env.TEST_TERMINAL_TIMEOUT
      ) {
        TIMEOUT_MS = parseInt(process.env.TEST_TERMINAL_TIMEOUT, 10);
      }

      /**
       * Appends a note about reduced limits when parallel tool calls are in effect.
       */
      const appendParallelLimitNote = (output: string): string => {
        if (parallelCount > 1) {
          return (
            output +
            `\n\n(Note: output limit reduced due to ${parallelCount} parallel tool calls. ` +
            `Single-tool limit: ${baseMaxChars.toLocaleString()} characters or ${baseMaxLines.toLocaleString()} lines.)`
          );
        }
        return output;
      };

      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          child.kill();
          let output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
          output += `\n\n[Command timed out after ${TIMEOUT_MS / 1000} seconds of no output]`;

          const truncationResult = truncateOutputFromStart(output, {
            maxChars,
            maxLines,
          });
          const finalOutput = truncationResult.wasTruncated
            ? appendParallelLimitNote(truncationResult.output)
            : truncationResult.output;
          resolve(finalOutput);
        }, TIMEOUT_MS);
      };

      // Start the initial timeout
      resetTimeout();

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        resetTimeout();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        resetTimeout();
      });

      child.on("close", (code) => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Only reject on non-zero exit code if there's also stderr
        if (code !== 0 && stderr) {
          reject(`Error (exit code ${code}): ${stderr}`);
          return;
        }

        // Track specific git operations only after successful execution
        if (code === 0) {
          if (isGitCommitCommand(command)) {
            telemetryService.recordCommitCreated();
          } else if (isPullRequestCommand(command)) {
            telemetryService.recordPullRequestCreated();
          }
        }

        let output = stdout;
        if (stderr) {
          output = stdout + `\nStderr: ${stderr}`;
        }

        const truncationResult = truncateOutputFromStart(output, {
          maxChars,
          maxLines,
        });
        const finalOutput = truncationResult.wasTruncated
          ? appendParallelLimitNote(truncationResult.output)
          : truncationResult.output;
        resolve(finalOutput);
      });

      child.on("error", (error) => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(`Error: ${error.message}`);
      });
    });
  },
};
