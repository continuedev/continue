import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const globSearchTool: Tool = {
  type: "function",
  displayTitle: "Glob File Search",
  wouldLikeTo: 'search for files like "{{{ pattern }}}"',
  isCurrently: 'searching for files like "{{{ pattern }}}"',
  hasAlready: 'searched for files like "{{{ pattern }}}"',
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FileGlobSearch,
    description:
      "Search for files recursively in the project using glob patterns. Supports ** for recursive directory search. Will not show many build, cache, secrets dirs/files (can use ls tool instead). Output may be truncated; use targeted patterns",
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
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To return a list of files based on a glob search pattern, use the ${BuiltInToolNames.FileGlobSearch} tool`,
    exampleArgs: [["pattern", "*.py"]],
  },
  toolCallIcon: "MagnifyingGlassIcon",
};
