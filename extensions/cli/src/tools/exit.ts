import { Tool } from "./types.js";

export const exitTool: Tool = {
  name: "Exit",
  displayName: "Exit",
  description:
    "Exit the current process with status code 1, indicating a failure or error",
  parameters: {
    type: "object",
    properties: {},
  },
  readonly: false,
  isBuiltIn: true,
  run: async (): Promise<string> => {
    const { gracefulExit } = await import("../util/exit.js");
    await gracefulExit(1);
    return "";
  },
};
