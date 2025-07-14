import { Tool } from "./types.js";

export const exitTool: Tool = {
  name: "exit",
  displayName: "Exit",
  description:
    "Exit the current process with status code 1, indicating a failure or error",
  parameters: {},
  run: async (args: { dirpath: string }): Promise<string> => {
    process.exit(1);
  },
};
