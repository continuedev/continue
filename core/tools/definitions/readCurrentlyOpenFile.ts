import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const readCurrentlyOpenFileTool: Tool = {
  type: "function",
  displayTitle: "Read Currently Open File",
  wouldLikeTo: "read the current file",
  readonly: true,
  function: {
    name: BuiltInToolNames.ReadCurrentlyOpenFile,
    description:
      "Read the currently open file in the IDE. If the user seems to be referring to a file that you can't see, try using this",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};
