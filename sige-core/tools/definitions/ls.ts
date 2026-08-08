import { Tool } from "../..";

import { ToolPolicy } from "@continuedev/terminal-security";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export const lsTool: Tool = {
  type: "function",
  displayTitle: "ls",
  wouldLikeTo: "list files in {{{ dirPath }}}",
  isCurrently: "listing files in {{{ dirPath }}}",
  hasAlready: "listed files in {{{ dirPath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.LSTool,
    description: "List files and folders in a given directory",
    parameters: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description:
            "The directory path. Can be relative to project root, absolute path, tilde path (~/...), or file:// URI. Use forward slash paths",
        },
        recursive: {
          type: "boolean",
          description:
            "If true, lists files and folders recursively. To prevent unexpected large results, use this sparingly",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To list files and folders in a given directory, call the ${BuiltInToolNames.LSTool} tool with "dirPath" and "recursive". For example:`,
    exampleArgs: [
      ["dirPath", "path/to/dir"],
      ["recursive", "false"],
    ],
  },
  toolCallIcon: "FolderIcon",
  preprocessArgs: async (args, { ide }) => {
    const dirPath = args.dirPath as string;

    // Default to current directory if no path provided
    const pathToResolve = dirPath || ".";
    const resolvedPath = await resolveInputPath(ide, pathToResolve);

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
