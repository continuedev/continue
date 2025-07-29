import { exec } from "child_process";
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
  preprocess: async (args) => {
    const truncatedCmd =
      args.command.length > 60
        ? args.command.substring(0, 60) + "..."
        : args.command;
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
      exec(command, (error, stdout, stderr) => {
        const exitCode = error?.code || 0;

        if (error) {
          reject(`Error: ${error.message}`);
          return;
        }

        // Track specific git operations
        if (isGitCommitCommand(command)) {
          telemetryService.recordCommitCreated();
        } else if (isPullRequestCommand(command)) {
          telemetryService.recordPullRequestCreated();
        }

        if (stderr) {
          resolve(`Stderr: ${stderr}`);
          return;
        }
        resolve(stdout);
      });
    });
  },
};
