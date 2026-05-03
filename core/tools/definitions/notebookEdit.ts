import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { NO_PARALLEL_TOOL_CALLING_INSTRUCTION } from "./editFile";

export const notebookEditTool: Tool = {
  type: "function",
  displayTitle: "Edit Notebook",
  wouldLikeTo: "edit notebook {{{ filepath }}}",
  isCurrently: "editing notebook {{{ filepath }}}",
  hasAlready: "edited notebook {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.NotebookEdit,
    description: `Use this tool to edit a Jupyter notebook (.ipynb) by replacing, inserting, or deleting a specific cell. Read the notebook first so you know the current cell ordering. Cell indices are zero-based. ${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}`,
    parameters: {
      type: "object",
      required: ["filepath", "cellIndex", "editMode"],
      properties: {
        filepath: {
          type: "string",
          description:
            "Path to the .ipynb notebook, relative to the workspace root or an absolute file URI/path.",
        },
        cellIndex: {
          type: "number",
          description:
            "Zero-based cell index. For insert, the new cell is inserted at this index.",
        },
        editMode: {
          type: "string",
          enum: ["replace", "insert", "delete"],
          description: "Whether to replace, insert, or delete a cell.",
        },
        newSource: {
          type: "string",
          description:
            "The new cell source. Required for replace and insert. Omit for delete.",
        },
        cellType: {
          type: "string",
          enum: ["code", "markdown"],
          description:
            "Cell type for insert, or to change the type on replace. Defaults to the existing cell type on replace.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To edit a notebook cell, use the ${BuiltInToolNames.NotebookEdit} tool after reading the notebook. For example:`,
    exampleArgs: [
      ["filepath", "analysis/example.ipynb"],
      ["cellIndex", 2],
      ["editMode", "replace"],
      ["newSource", "print('updated')"],
      ["cellType", "code"],
    ],
  },
  toolCallIcon: "DocumentDuplicateIcon",
};