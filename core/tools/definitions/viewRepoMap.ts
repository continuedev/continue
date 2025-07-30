import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../systemMessageTools/buildToolsSystemMessage";

export const viewRepoMapTool: Tool = {
  type: "function",
  displayTitle: "View Repo Map",
  wouldLikeTo: "view the repository map",
  isCurrently: "getting the repository map",
  hasAlready: "viewed the repository map",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ViewRepoMap,
    description: "View the repository map",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.ViewRepoMap,
    `To view the repository map, use the ${BuiltInToolNames.ViewRepoMap} tool. This will provide a visual representation of the project's structure and organization.`,
    [],
  ),
};
