import { Tool } from "./types.js";

export const exitTool: Tool = {
  type: "function",
  function: {
    name: "Exit",
    description:
      "Exit the current process with status code 1, indicating a failure or error",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  displayTitle: "Exit",
  readonly: false,
  group: "Built-In",
  isBuiltIn: true,
  run: async (): Promise<string> => {
    const { gracefulExit } = await import("../util/exit.js");
    await gracefulExit(1);
    return "";
  },
};
