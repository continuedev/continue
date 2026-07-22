import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readCurrentlyOpenFileTool: Tool = {
  type: "function",
  displayTitle: "Read Currently Open File",
  wouldLikeTo: "read the current file",
  isCurrently: "reading the current file",
  hasAlready: "read the current file",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadCurrentlyOpenFile,
    description:
      "Read the currently open file in the IDE. If the user seems to be referring to a file that you can't see, or is requesting an action on content that seems missing, try using this tool. For large files, use the offset and limit parameters to read a specific range of lines. When the response indicates more lines are available, continue reading with the next offset.",
    parameters: {
      type: "object",
      properties: {
        offset: {
          type: "number",
          description:
            "The 1-based line number to start reading from. Defaults to 1 (beginning of file).",
        },
        limit: {
          type: "number",
          description:
            "The maximum number of lines to read. Defaults to 2000. Output is also capped at 50 KB regardless of this value.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To view the user's currently open file, use the ${BuiltInToolNames.ReadCurrentlyOpenFile} tool.
If the user is asking about a file and you don't see any code, use this to check the current file`,
  },
  toolCallIcon: "DocumentTextIcon",
};
