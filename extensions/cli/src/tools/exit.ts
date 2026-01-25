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
    const { gracefulExit, updateAgentMetadata } = await import(
      "../util/exit.js"
    );

    // Mark agent as complete before exiting
    try {
      await updateAgentMetadata({ isComplete: true });
    } catch (err) {
      // Non-critical: log but don't block exit
      console.debug("Failed to update completion metadata (non-critical)", err);
    }

    await gracefulExit(1);
    return "";
  },
};
