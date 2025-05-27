import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../instructionTools/buildXmlToolsSystemMessage";

export const readFileTool: Tool = {
  type: "function",
  displayTitle: "Read File",
  wouldLikeTo: "read {{{ filepath }}}",
  isCurrently: "reading {{{ filepath }}}",
  hasAlready: "viewed {{{ filepath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ReadFile,
    description:
      "Use this tool if you need to view the contents of an existing file.",
    parameters: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path of the file to read, relative to the root of the workspace (NOT uri or absolute path)",
        },
      },
    },
  },
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.ReadFile,
    `
      <filepath>/path/to/file.txt</filepath>
  `.trim(),
  ),
};
