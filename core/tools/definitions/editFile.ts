import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface EditToolArgs {
  filepath: string;
  new_contents: string;
}

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  function: {
    name: BuiltInToolNames.EditExistingFile,
    description:
      "Use this tool to edit an existing file. If you don't know the contents of the file, read it first.",
    parameters: {
      type: "object",
      required: ["filepath", "new_contents"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to edit, relative to the root of the workspace.",
        },
        new_contents: {
          type: "string",
          description: "The new file contents",
        },
      },
    },
  },
};
