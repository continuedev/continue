/**
 * LspQueryTool — ported and adapted from Marcel (Yuto Code) LSPTool.
 *
 * Gives the agent access to language server intelligence: go-to-definition,
 * find-references, hover (document symbols), and diagnostics.
 * Backed by Continue's existing IDE.gotoDefinition / getReferences /
 * getDocumentSymbols / getProblems bridge.
 */
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export type LspOperation =
  | "goToDefinition"
  | "findReferences"
  | "documentSymbols"
  | "getProblems";

export const lspQueryTool: Tool = {
  type: "function",
  displayTitle: "LSP Query",
  wouldLikeTo: "query the language server for {{{ operation }}} on {{{ filePath }}}",
  isCurrently: "querying the language server",
  hasAlready: "queried the language server",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.LspQuery,
    description: `Query the Language Server Protocol (LSP) for code intelligence.

Supported operations:
- goToDefinition: Find where a symbol at the given position is defined.
- findReferences: Find all references to the symbol at the given position.
- documentSymbols: List all symbols (functions, classes, variables) in a file.
- getProblems: Get compiler/linter diagnostics for a file (or all open files).

Position fields (line, character) are 1-based as shown in editors.
For documentSymbols and getProblems, position is not required.`,
    parameters: {
      type: "object",
      required: ["operation", "filePath"],
      properties: {
        operation: {
          type: "string",
          enum: [
            "goToDefinition",
            "findReferences",
            "documentSymbols",
            "getProblems",
          ],
          description: "The LSP operation to perform.",
        },
        filePath: {
          type: "string",
          description: "Absolute or workspace-relative path to the file.",
        },
        line: {
          type: "number",
          description:
            "1-based line number. Required for goToDefinition and findReferences.",
        },
        character: {
          type: "number",
          description:
            "1-based character offset. Required for goToDefinition and findReferences.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To get code intelligence from the language server, use the ${BuiltInToolNames.LspQuery} tool. For example, to find where a symbol at line 42 character 8 is defined:`,
    exampleArgs: [
      ["operation", "goToDefinition"],
      ["filePath", "src/utils/helpers.ts"],
      ["line", "42"],
      ["character", "8"],
    ],
  },
};
