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

import { Tool } from "./types.js";

// Maximum number of lines and characters to return from command output
const MAX_OUTPUT_LINES = 5000;
const MAX_OUTPUT_CHARS = 200000;

// Helper function to truncate command output by both lines and characters
// Keeps the LAST X lines/chars to capture test/install outcomes
function truncateOutput(output: string): string {
  const lines = output.split("\n");
  let truncated = output;
  let truncationMsg = "";

  // First check character limit - keep last X characters
  if (output.length > MAX_OUTPUT_CHARS) {
    const startIndex = output.length - MAX_OUTPUT_CHARS;
    truncated = output.substring(startIndex);
    truncationMsg = `[Output truncated: showing last ${MAX_OUTPUT_CHARS} characters of ${output.length} total]\n\n`;
  }
  // Then check line limit (only if not already truncated by characters) - keep last X lines
  else if (lines.length > MAX_OUTPUT_LINES) {
    truncated = lines.slice(-MAX_OUTPUT_LINES).join("\n");
    truncationMsg = `[Output truncated: showing last ${MAX_OUTPUT_LINES} lines of ${lines.length} total]\n\n`;
  }

  return truncationMsg ? truncationMsg + truncated : truncated;
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
`,
  parameters: {
    type: "object",
    required: ["command"],
    properties: {
      command: {
        type: "string",
        description: "The command to execute in the terminal.",
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
  run: async ({ command }: { command: string }): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Use same shell logic as core implementation
      const { shell, args } = getShellCommand(command);
      const child = spawn(shell, args);
      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      const TIMEOUT_MS =
        process.env.NODE_ENV === "test" && process.env.TEST_TERMINAL_TIMEOUT
          ? parseInt(process.env.TEST_TERMINAL_TIMEOUT, 10)
          : 30000; // 30 seconds default, configurable for tests

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

          // Truncate output by both lines and characters
          const truncatedOutput = truncateOutput(output);
          resolve(truncatedOutput);
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

        // Truncate output by both lines and characters
        const truncatedOutput = truncateOutput(output);
        resolve(truncatedOutput);
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
