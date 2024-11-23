import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const exactSearchTool: Tool = {
  type: "function",
  function: {
    name: BuiltInToolNames.ExactSearch,
    description: "Perform an exact search over the repository using ripgrep",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The search query to use",
        },
      },
    },
  },
};
