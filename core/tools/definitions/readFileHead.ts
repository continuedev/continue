import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readFileHeadTool: Tool = {
  type: "function",
  displayTitle: "Read File Head",
  wouldLikeTo: "read the first {{{ lines }}} lines of {{{ filepath }}}",
  isCurrently: "reading the first {{{ lines }}} lines of {{{ filepath }}}",
  hasAlready: "viewed the first {{{ lines }}} lines of {{{ filepath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadFileHead,
    description:
      "Use this tool to read the first N lines from the beginning of a file. Similar to the Unix 'head' command.",
    parameters: {
      type: "object",
      required: ["filepath", "lines"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to read, relative to the root of the workspace (NOT uri or absolute path)",
        },
        lines: {
          type: "number",
          description:
            "The number of lines to read from the beginning of the file (must be positive)",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To read the first N lines of a file, use the ${BuiltInToolNames.ReadFileHead} tool. For example, to read the first 20 lines of a file:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.txt"],
      ["lines", "20"],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
};