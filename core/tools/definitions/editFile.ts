import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  readonly: false,
  function: {
    name: BuiltInToolNames.EditExistingFile,
    description:
      "To edit an existing file, call this tool and follow the returned instructions. If you don't have the contents of the file, read it first.",
    parameters: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to edit, relative to the root of the workspace.",
        },
      },
    },
  },
};
