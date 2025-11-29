import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const COMMAND_OPTIONS = [
  "view",
  "create",
  "insert",
  "str_replace",
  "delete",
  "rename",
];

export const memoryTool: Tool = {
  type: "function",
  displayTitle: "Memory",
  wouldLikeTo:
    "manage persistent memories using the {{{ command }}} command at {{{ path }}}",
  isCurrently:
    "managing persistent memories using the {{{ command }}} command at {{{ path }}}",
  hasAlready:
    "managed persistent memories using the {{{ command }}} command at {{{ path }}}",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Memory,
    type: "memory_20250818",
    description: "Anthropic claude memory tool",
    parameters: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          enum: COMMAND_OPTIONS,
          description:
            "The memory operation to perform: view, create, insert, str_replace, delete, or rename.",
        },
        path: {
          type: "string",
          description:
            "Path within the /memories namespace targeted by the command. Must begin with /memories.",
        },
        view_range: {
          type: "array",
          description:
            "Optional [start, end] line range (1-indexed, inclusive) when viewing a memory file. Use -1 for end to read to EOF.",
          items: { type: "number" },
        },
        file_text: {
          type: "string",
          description: "Content to write when creating a new memory file.",
        },
        insert_line: {
          type: "number",
          description:
            "0-based line number where insert_text should be added when using the insert command.",
        },
        insert_text: {
          type: "string",
          description: "Text to insert when using the insert command.",
        },
        old_str: {
          type: "string",
          description:
            "Existing text to replace when using the str_replace command. Must appear exactly once.",
        },
        new_str: {
          type: "string",
          description:
            "Replacement text to use when the str_replace command is invoked.",
        },
        old_path: {
          type: "string",
          description: "Existing path to rename when using the rename command.",
        },
        new_path: {
          type: "string",
          description: "New path to rename to when using the rename command.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To manage long-term memories stored under /memories, use the ${BuiltInToolNames.Memory} tool. Always provide a command (view, create, insert, str_replace, delete, or rename) and paths that begin with /memories. For example, to view the index file you could respond with:`,
    exampleArgs: [
      ["command", "view"],
      ["path", "/memories/index.md"],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "ArchiveBoxIcon",
};
