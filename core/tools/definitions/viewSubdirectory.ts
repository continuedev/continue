import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const viewSubdirectoryTool: Tool = {
  type: "function",
  displayTitle: "View Subdirectory",
  wouldLikeTo: 'view the contents of "{{{ directory_path }}}"',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ViewSubdirectory,
    description: "View the contents of a subdirectory",
    parameters: {
      type: "object",
      required: ["directory_path"],
      properties: {
        directory_path: {
          type: "string",
          description:
            "The path of the subdirectory to view, relative to the root of the workspace",
        },
      },
    },
  },
};
