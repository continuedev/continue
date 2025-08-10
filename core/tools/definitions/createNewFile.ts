import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const createNewFileTool: Tool = {
  type: "function",
  displayTitle: "Create New File",
  wouldLikeTo: "create a new file at {{{ filepath }}}",
  isCurrently: "creating a new file at {{{ filepath }}}",
  hasAlready: "created a new file at {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: true,
  function: {
    name: BuiltInToolNames.CreateNewFile,
    description:
      "Create a new file. Only use this when a file doesn't exist and should be created",
    parameters: {
      type: "object",
      required: ["filepath", "contents"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path where the new file should be created, relative to the root of the workspace",
        },
        contents: {
          type: "string",
          description: "The contents to write to the new file",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To create a NEW file, use the ${BuiltInToolNames.CreateNewFile} tool with the relative filepath and new contents. For example, to create a file located at 'path/to/file.txt', you would respond with:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.txt"],
      ["contents", "Contents of the file"],
    ],
  },
};
