import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const LSP_TOOLS: Tool[] = [
  {
    name: "getDefinition",
    description:
      "Get the definition location of a symbol at a specific position in a file. Returns the definition with file contents.",
    inputSchema: {
      type: "object",
      required: ["filepath", "line", "character"],
      properties: {
        filepath: {
          type: "string",
          description: "Absolute file path",
        },
        line: {
          type: "number",
          description: "Zero-indexed line number",
        },
        character: {
          type: "number",
          description: "Zero-indexed character position",
        },
      },
    },
  },
  {
    name: "findReferences",
    description:
      "Find all references to a symbol at a specific position across the workspace",
    inputSchema: {
      type: "object",
      required: ["filepath", "line", "character"],
      properties: {
        filepath: {
          type: "string",
          description: "Absolute file path",
        },
        line: {
          type: "number",
          description: "Zero-indexed line number",
        },
        character: {
          type: "number",
          description: "Zero-indexed character position",
        },
        includeDeclaration: {
          type: "boolean",
          description: "Include the declaration in results",
          default: false,
        },
      },
    },
  },
  {
    name: "getHover",
    description:
      "Get type information and documentation for a symbol at a specific position",
    inputSchema: {
      type: "object",
      required: ["filepath", "line", "character"],
      properties: {
        filepath: {
          type: "string",
          description: "Absolute file path",
        },
        line: {
          type: "number",
          description: "Zero-indexed line number",
        },
        character: {
          type: "number",
          description: "Zero-indexed character position",
        },
      },
    },
  },
  {
    name: "getDiagnostics",
    description:
      "Get compiler errors, warnings, and hints for a file from the language server",
    inputSchema: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description: "Absolute file path",
        },
      },
    },
  },
  {
    name: "getDocumentSymbols",
    description:
      "Get all symbols (functions, classes, variables, etc.) defined in a document",
    inputSchema: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description: "Absolute file path",
        },
      },
    },
  },
  {
    name: "getWorkspaceSymbols",
    description: "Search for symbols across the entire workspace by name query",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Symbol name to search for (supports partial matching)",
        },
      },
    },
  },
];
