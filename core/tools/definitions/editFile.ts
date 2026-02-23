import { Tool } from "../..";
import { EDIT_CODE_INSTRUCTIONS } from "../../llm/defaultSystemMessages";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface EditToolArgs {
  filepath: string;
  changes: string;
}

export const NO_PARALLEL_TOOL_CALLING_INSTRUCTION =
  "This tool CANNOT be called in parallel with any other tools, including itself";

const CHANGES_DESCRIPTION =
  "Any modifications to the file, showing only needed changes. Do NOT wrap this in a codeblock or write anything besides the code changes. In larger files, use brief language-appropriate placeholders for large unmodified sections, e.g. '// ... existing code ...'";

export const editFileTool: Tool = {
  type: "function",
  displayTitle: "Edit File",
  wouldLikeTo: "edit {{{ filepath }}}",
  isCurrently: "editing {{{ filepath }}}",
  hasAlready: "edited {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: false,
  function: {
    name: BuiltInToolNames.EditExistingFile,
    description: `Use this tool to edit an existing file. If you don't know the contents of the file, read it first.\n${EDIT_CODE_INSTRUCTIONS}\n${NO_PARALLEL_TOOL_CALLING_INSTRUCTION}`,
    parameters: {
      type: "object",
      required: ["filepath", "changes"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to edit, relative to the root of the workspace.",
        },
        changes: {
          type: "string",
          description: CHANGES_DESCRIPTION,
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To edit an EXISTING file, use the ${BuiltInToolNames.EditExistingFile} tool with
- filepath: the relative filepath to the file.
- changes: ${CHANGES_DESCRIPTION}
Only use this tool if you already know the contents of the file. Otherwise, use the ${BuiltInToolNames.ReadFile} or ${BuiltInToolNames.ReadCurrentlyOpenFile} tool to read it first.
For example:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.ts"],
      [
        "changes",
        "// ... existing code ...\nfunction subtract(a: number, b: number): number {\n  return a - b;\n}\n// ... rest of code ...",
      ],
    ],
  },
};
