import { exec } from "child_process";
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
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error: ${error.message}`);
          return;
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
