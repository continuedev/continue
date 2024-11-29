import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const readFileTool: Tool = {
  type: "function",
  displayTitle: "Read File",
  wouldLikeTo: "read {{{ filepath }}}",
  readonly: true,
  function: {
    name: BuiltInToolNames.ReadFile,
    description:
      "Use this tool whenever you need to view the contents of a file.",
    parameters: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to read, relative to the root of the workspace.",
        },
      },
    },
  },
};
