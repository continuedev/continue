import { Tool } from "../..";

import { BuiltInToolNames } from "../builtIn";

export const viewDiffTool: Tool = {
  type: "function",
  function: {
    name: BuiltInToolNames.ViewDiff,
    description: "View the current diff of working changes",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
