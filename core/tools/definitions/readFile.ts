import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export const readFileTool: Tool = {
  type: "function",
  displayTitle: "Read File",
  wouldLikeTo: "read {{{ filepath }}}",
  isCurrently: "reading {{{ filepath }}}",
  hasAlready: "read {{{ filepath }}}",
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
            "The path of the file to read. Can be a relative path (from workspace root), absolute path, tilde path (~/...), or file:// URI",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To read a file with a known filepath, use the ${BuiltInToolNames.ReadFile} tool. For example, to read a file located at 'path/to/file.txt', you would respond with this:`,
    exampleArgs: [["filepath", "path/to/the_file.txt"]],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "DocumentIcon",
  preprocessArgs: async (args, { ide }) => {
    const filepath = args.filepath as string;
    const resolvedPath = await resolveInputPath(ide, filepath);

    // Store the resolved path info in args for policy evaluation
    return {
      resolvedPath,
    };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPath = processedArgs?.resolvedPath as
      | ResolvedPath
      | null
      | undefined;
    if (!resolvedPath) return basePolicy;

    return evaluateFileAccessPolicy(basePolicy, resolvedPath.isWithinWorkspace);
  },
};
