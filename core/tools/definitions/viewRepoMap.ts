import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const viewRepoMapTool: Tool = {
  type: "function",
  displayTitle: "View Repo Map",
  wouldLikeTo: "view the repository map",
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ViewRepoMap,
    description: "View the repository map",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
