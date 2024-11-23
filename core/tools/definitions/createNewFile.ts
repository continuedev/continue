import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const createNewFileTool: Tool = {
  type: "function",
  function: {
    name: BuiltInToolNames.CreateNewFile,
    description: "Create a new file",
    parameters: {
      type: "object",
      required: ["filepath", "contents"],
      properties: {
        filepath: {
          type: "string",
          description: "The path where the new file should be created",
        },
        contents: {
          type: "string",
          description: "The contents to write to the new file",
        },
      },
    },
  },
};
