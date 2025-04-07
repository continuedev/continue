import { Tool } from "./types.js";
import { exec } from "child_process";

export const runTerminalCommandTool: Tool = {
  name: "run_terminal_command",
  description: "Executes a terminal command and returns the output.",
  parameters: {
    command: {
      type: "string",
      description: "The command to execute in the terminal.",
      required: true,
    },
  },
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
