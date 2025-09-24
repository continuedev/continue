import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readFileRangeTool: Tool = {
  type: "function",
  displayTitle: "Read File Range",
  wouldLikeTo:
    "read lines {{{ startLine }}}-{{{ endLine }}} of {{{ filepath }}}",
  isCurrently:
    "reading lines {{{ startLine }}}-{{{ endLine }}} of {{{ filepath }}}",
  hasAlready:
    "read lines {{{ startLine }}}-{{{ endLine }}} of {{{ filepath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadFileRange,
    description:
      "Use this tool to read a specific range of lines from an existing file. Only supports positive line numbers (1-based from start). For reading from the end of a file, use the terminal tool with 'tail' command instead.",
    parameters: {
      type: "object",
      required: ["filepath", "startLine", "endLine"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to read, relative to the root of the workspace (NOT uri or absolute path)",
        },
        startLine: {
          type: "number",
          description:
            "The starting line number (1-based from start). Must be a positive integer. Example: 1 = first line, 10 = tenth line",
        },
        endLine: {
          type: "number",
          description:
            "The ending line number (1-based from start). Must be a positive integer greater than or equal to startLine. Example: 10 = tenth line, 20 = twentieth line",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To read a specific range of lines from a file, use the ${BuiltInToolNames.ReadFileRange} tool. Only supports positive line numbers (1-based from start). For reading from the end of files, use the terminal tool with 'tail' command instead:`,
    exampleArgs: [
      ["filepath", "path/to/the_file.txt"],
      ["startLine", 10],
      ["endLine", 20],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "DocumentIcon",
};
