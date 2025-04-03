import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const globTool: Tool = {
  type: "function",
  displayTitle: "Glob Tool",
  wouldLikeTo: "search files and folders in {{{ dirPath }}}",
  isCurrently: "searching files and folders in {{{ dirPath }}}",
  hasAlready: "listed files and folders in {{{ dirPath }}}",
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.GlobTool,
    description: "Finds files based on pattern matching",
    parameters: {
      type: "object",
      required: ["globPattern"],
      properties: {
        recursive: {
          type: "boolean",
          description:
            "If true, lists files and folders recursively. To prevent unexpected large results, use this sparingly",
        },
        dirPath: {
          type: "string",
          description:
            "The directory path to search relative to the root of the project. Always use forward slash paths like '/'. rather than e.g. '.'",
        },
      },
    },
  },
};
