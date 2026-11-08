import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { CODE_NAVIGATION_OPERATIONS } from "../implementations/codeNavigation";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

/**
 * Semantic navigation through the IDE's language servers: what grep cannot
 * tell (which `save` this is, every caller, the real type, current errors).
 * One tool with an operation, not six: each tool definition is resent in the
 * prompt on every request.
 */
export const codeNavigationTool: Tool = {
  type: "function",
  displayTitle: "Code Navigation",
  wouldLikeTo: "look up {{{ operation }}} {{{ symbol }}} {{{ filepath }}}",
  isCurrently: "looking up {{{ operation }}} {{{ symbol }}} {{{ filepath }}}",
  hasAlready: "looked up {{{ operation }}} {{{ symbol }}} {{{ filepath }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.CodeNavigation,
    description: `Ask the editor's language servers about code. More precise than grep_search for code: it knows which declaration a name refers to, through imports, re-exports and overloads.
Operations:
- symbols: find where a symbol is declared across the workspace. Needs symbol (a name or part of one).
- outline: the classes, functions and members of a file, with line numbers. Needs filepath.
- definition / type_definition: where a symbol used in a file is defined (or its type is), with the code. Needs filepath and symbol; line helps when the name appears more than once.
- references: every use of a symbol across the workspace. Needs filepath and symbol (where it is declared or used); line helps.
- problems: the errors and warnings the editor shows for a file. Needs filepath.
Results depend on the language's extension being installed; if one comes back empty, fall back to grep_search or read_file.`,
    parameters: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: [...CODE_NAVIGATION_OPERATIONS],
          description: "What to look up.",
        },
        symbol: {
          type: "string",
          description:
            "The symbol's name as written in the code, e.g. handleApplyStateUpdate or Config.load. For symbols, part of a name is enough.",
        },
        filepath: {
          type: "string",
          description:
            "The file, relative to the workspace root. For definition, type_definition and references: a file where the symbol appears.",
        },
        line: {
          type: "number",
          description:
            "Optional 1-based line where the symbol appears, to pick the right occurrence.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To navigate code by meaning (definitions, references, a file's outline, workspace symbols, or a file's current errors), use the ${BuiltInToolNames.CodeNavigation} tool. For example, to find where a function is defined:`,
    exampleArgs: [
      ["operation", "definition"],
      ["filepath", "src/app.ts"],
      ["symbol", "loadConfig"],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "MagnifyingGlassIcon",
  preprocessArgs: async (args, { ide }) => {
    const filepath = args.filepath as string | undefined;
    if (!filepath) return {};
    return { resolvedPath: await resolveInputPath(ide, filepath) };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPath = processedArgs?.resolvedPath as
      ResolvedPath | null | undefined;
    if (!resolvedPath) return basePolicy;
    return evaluateFileAccessPolicy(basePolicy, resolvedPath.isWithinWorkspace);
  },
};
