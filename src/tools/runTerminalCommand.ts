import { spawn } from "child_process";
import telemetryService from "../telemetry/telemetryService.js";
import {
  isGitCommitCommand,
  isPullRequestCommand,
} from "../telemetry/utils.js";
import { Tool } from "./types.js";

export const runTerminalCommandTool: Tool = {
  name: "run_terminal_command",
  displayName: "Bash",
  description: "Executes a terminal command and returns the output",
  parameters: {
    command: {
      type: "string",
      description: "The command to execute in the terminal.",
      required: true,
    },
  },
  readonly: false,
  isBuiltIn: true,
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
      const child = spawn("sh", ["-c", command]);
      let stdout = "";
      let stderr = "";
      let lastOutputTime = Date.now();
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      const TIMEOUT_MS = process.env.NODE_ENV === 'test' && process.env.TEST_TERMINAL_TIMEOUT 
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
          const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
          resolve(
            output + `\n\n[Command timed out after ${TIMEOUT_MS / 1000} seconds of no output]`
          );
        }, TIMEOUT_MS);
      };

      // Start the initial timeout
      resetTimeout();

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        lastOutputTime = Date.now();
        resetTimeout();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        lastOutputTime = Date.now();
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

        if (stderr) {
          resolve(stdout + `\nStderr: ${stderr}`);
          return;
        }
        resolve(stdout);
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
