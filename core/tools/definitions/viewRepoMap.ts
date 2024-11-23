import { Tool } from "../..";

import { BuiltInToolNames } from "../builtIn";

export const viewRepoMapTool: Tool = {
  type: "function",
  displayTitle: "View Repo Map",
  wouldLikeTo: "view the repository map",
  function: {
    name: BuiltInToolNames.ViewRepoMap,
    description: "View the repository map",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
