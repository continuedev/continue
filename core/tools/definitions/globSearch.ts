import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const globSearchTool: Tool = {
  type: "function",
  displayTitle: "Glob File Search",
  wouldLikeTo: 'find file matches for "{{{ pattern }}}"',
  isCurrently: 'finding file matches for "{{{ pattern }}}"',
  hasAlready: 'retreived file matches for "{{{ pattern }}}"',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FileGlobSearch,
    description: "Search for files in the project",
    parameters: {
      type: "object",
      required: ["pattern"],
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern for file path matching",
        },
      },
    },
  },
};
