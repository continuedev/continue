import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  readonly: false,
  function: {
    name: BuiltInToolNames.EditFile,
    description:
      "Use this tool whenever you need to edit the contents of an existing file",
    parameters: {
      type: "object",
      required: ["filepath", "new_contents"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to read, relative to the root of the workspace.",
        },
        new_contents: {
          type: "string",
          description: "The new contents of the file",
        },
      },
    },
  },
};
