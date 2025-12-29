import { spawn } from "child_process";

import {
  evaluateTerminalCommandSecurity,
  type ToolPolicy,
} from "@continuedev/terminal-security";

import { telemetryService } from "../telemetry/telemetryService.js";
import {
  isCommentCommand,
  isCommentReplyCommand,
  isGitCommitCommand,
  isGitPushCommand,
  isIssueCloseCommand,
  isPullRequestCommand,
  isResolveThreadCommand,
  isReviewCommand,
} from "../telemetry/utils.js";
import {
  ParsedEventDetails,
  parseCommentOutput,
  parseCommentReplyOutput,
  parseGitPushOutput,
  parseIssueCloseOutput,
  parsePrCreatedOutput,
  parseResolveThreadOutput,
  parseReviewOutput,
} from "../util/commandEventParser.js";
import { getAgentIdFromArgs, postAgentEvent } from "../util/events.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

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

/**
 * Emit an action event to the control plane for Activity Timeline.
 * Non-blocking - errors are logged but don't fail the command.
 */
async function emitActionEvent(
  agentId: string,
  command: string,
  output: string,
): Promise<void> {
  try {
    let eventDetails: ParsedEventDetails | null = null;

    if (isPullRequestCommand(command)) {
      eventDetails = parsePrCreatedOutput(output);
    } else if (isCommentCommand(command)) {
      eventDetails = parseCommentOutput(command, output);
    } else if (isGitPushCommand(command)) {
      eventDetails = parseGitPushOutput(output);
    } else if (isIssueCloseCommand(command)) {
      eventDetails = parseIssueCloseOutput(command);
    } else if (isReviewCommand(command)) {
      eventDetails = parseReviewOutput(command);
    } else if (isCommentReplyCommand(command)) {
      // gh api -X POST repos/.../pulls/.../comments/.../replies
      eventDetails = parseCommentReplyOutput(command);
    } else if (isResolveThreadCommand(command)) {
      // gh api graphql ... resolveReviewThread
      eventDetails = parseResolveThreadOutput();
    }

    if (eventDetails) {
      await postAgentEvent(agentId, eventDetails);
    }
  } catch (error) {
    // Non-blocking - log but don't fail the command
    logger.debug("Failed to emit action event", error);
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
  run: async ({
    command,
    timeout,
  }: {
    command: string;
    timeout?: number;
  }): Promise<string> => {
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

          // Truncate output if it has too many lines
          const lines = output.split("\n");
          if (lines.length > 5000) {
            const truncatedOutput = lines.slice(0, 5000).join("\n");
            resolve(
              truncatedOutput +
                `\n\n[Output truncated to first 5000 lines of ${lines.length} total]`,
            );
            return;
          }

          resolve(output);
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

          // Emit activity events for Timeline (non-blocking)
          const agentId = getAgentIdFromArgs();
          if (agentId) {
            void emitActionEvent(agentId, command, stdout);
          }
        }

        let output = stdout;
        if (stderr) {
          output = stdout + `\nStderr: ${stderr}`;
        }

        // Truncate output if it has too many lines
        const lines = output.split("\n");
        if (lines.length > 5000) {
          const truncatedOutput = lines.slice(0, 5000).join("\n");
          resolve(
            truncatedOutput +
              `\n\n[Output truncated to first 5000 lines of ${lines.length} total]`,
          );
          return;
        }

        resolve(output);
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
