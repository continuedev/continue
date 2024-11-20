import { Tool } from "..";

export const viewDiffTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const diff = await extras.ide.getDiff(true);
    return diff;
  },
  function: {
    name: "view_diff",
    description: "View the current diff of working changes",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
