import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const viewDiffTool: Tool = {
  type: "function",
  displayTitle: "View Diff",
  wouldLikeTo: "view the git diff",
  isCurrently: "getting the git diff",
  hasAlready: "viewed the git diff",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ViewDiff,
    description: "View the current diff of working changes",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
