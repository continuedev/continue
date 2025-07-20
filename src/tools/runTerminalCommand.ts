import { exec } from "child_process";
import { telemetryService } from "../telemetry.js";
import { extractCommandType, isGitCommitCommand, isPullRequestCommand } from "../telemetry/utils.js";
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
  run: async ({ command }: { command: string }): Promise<string> => {
    const commandType = extractCommandType(command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        const exitCode = error?.code || 0;
        
        if (error) {
          // Record failed terminal command
          telemetryService.recordTerminalCommand(commandType, 'error', exitCode);
          reject(`Error: ${error.message}`);
          return;
        }
        
        // Record successful terminal command
        telemetryService.recordTerminalCommand(commandType, 'success', exitCode);
        
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