import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const viewSubdirectoryTool: Tool = {
  type: "function",
  displayTitle: "View Subdirectory",
  wouldLikeTo: 'view the contents of "{{{ directory_path }}}"',
  readonly: true,
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
