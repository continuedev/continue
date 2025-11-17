import * as vscode from "vscode";

import type { IDE } from "../..";
import {
  executeGotoProvider,
  executeSymbolProvider,
} from "../../../extensions/vscode/src/autocomplete/lsp.js";
import { LSP_TOOLS } from "./LspToolDefinitions.js";

/**
 * Bridge between Code Mode sandbox and VS Code LSP providers.
 * Provides semantic code navigation capabilities to sandbox TypeScript code.
 */
export class LspMcpBridge {
  constructor(private ide: IDE) {}

  /**
   * Get all available LSP tools for wrapper generation
   */
  getTools() {
    return LSP_TOOLS;
  }

  /**
   * Execute an LSP tool by name
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    try {
      switch (toolName) {
        case "getDefinition":
          return await this.getDefinition(args as any);
        case "findReferences":
          return await this.findReferences(args as any);
        case "getHover":
          return await this.getHover(args as any);
        case "getDiagnostics":
          return await this.getDiagnostics(args as any);
        case "getDocumentSymbols":
          return await this.getDocumentSymbols(args as any);
        case "getWorkspaceSymbols":
          return await this.getWorkspaceSymbols(args as any);
        default:
          throw new Error(`Unknown LSP tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`LSP tool ${toolName} error:`, error);
      // Return empty results instead of throwing to avoid crashing sandbox
      return this.getEmptyResult(toolName);
    }
  }

  private getEmptyResult(toolName: string): any {
    switch (toolName) {
      case "getHover":
        return null;
      default:
        return [];
    }
  }

  private async getDefinition(args: {
    filepath: string;
    line: number;
    character: number;
  }) {
    try {
      const uri = vscode.Uri.parse(args.filepath);
      const definitions = await executeGotoProvider({
        uri,
        line: args.line,
        character: args.character,
        name: "vscode.executeDefinitionProvider",
      });

      // Read contents for each definition
      const results = await Promise.all(
        definitions.map(async (def) => {
          try {
            const contents = await this.ide.readRangeInFile(
              def.filepath,
              def.range,
            );
            return {
              filepath: def.filepath,
              range: {
                start: {
                  line: def.range.start.line,
                  character: def.range.start.character,
                },
                end: {
                  line: def.range.end.line,
                  character: def.range.end.character,
                },
              },
              contents,
            };
          } catch (err) {
            console.warn("Error reading definition contents:", err);
            return null;
          }
        }),
      );

      return results.filter(Boolean);
    } catch (e) {
      console.warn("Error getting definitions:", e);
      return [];
    }
  }

  private async findReferences(args: {
    filepath: string;
    line: number;
    character: number;
    includeDeclaration?: boolean;
  }) {
    try {
      const uri = vscode.Uri.parse(args.filepath);
      const references = await executeGotoProvider({
        uri,
        line: args.line,
        character: args.character,
        name: "vscode.executeReferenceProvider",
      });

      return references.map((ref) => ({
        filepath: ref.filepath,
        range: {
          start: {
            line: ref.range.start.line,
            character: ref.range.start.character,
          },
          end: {
            line: ref.range.end.line,
            character: ref.range.end.character,
          },
        },
      }));
    } catch (e) {
      console.warn("Error finding references:", e);
      return [];
    }
  }

  private async getHover(args: {
    filepath: string;
    line: number;
    character: number;
  }) {
    try {
      const uri = vscode.Uri.parse(args.filepath);

      const hover = (await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        uri,
        new vscode.Position(args.line, args.character),
      )) as vscode.Hover[];

      if (!hover || hover.length === 0) {
        return null;
      }

      // Extract markdown content
      const contents = hover[0].contents
        .map((content) => {
          if (typeof content === "string") {
            return content;
          }
          return content.value;
        })
        .join("\n\n");

      return {
        contents,
        range: hover[0].range
          ? {
              start: {
                line: hover[0].range.start.line,
                character: hover[0].range.start.character,
              },
              end: {
                line: hover[0].range.end.line,
                character: hover[0].range.end.character,
              },
            }
          : undefined,
      };
    } catch (e) {
      console.warn("Error getting hover info:", e);
      return null;
    }
  }

  private async getDiagnostics(args: { filepath: string }) {
    try {
      const uri = vscode.Uri.parse(args.filepath);
      const diagnostics = vscode.languages.getDiagnostics(uri);

      return diagnostics.map((d) => ({
        message: d.message,
        severity: d.severity, // 0=Error, 1=Warning, 2=Info, 3=Hint
        range: {
          start: {
            line: d.range.start.line,
            character: d.range.start.character,
          },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        source: d.source,
        code: d.code,
      }));
    } catch (e) {
      console.warn("Error getting diagnostics:", e);
      return [];
    }
  }

  private async getDocumentSymbols(args: { filepath: string }) {
    try {
      const uri = vscode.Uri.parse(args.filepath);

      const symbols = await executeSymbolProvider({
        uri,
        name: "vscode.executeDocumentSymbolProvider",
      });

      return symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        range: {
          start: {
            line: s.range.start.line,
            character: s.range.start.character,
          },
          end: {
            line: s.range.end.line,
            character: s.range.end.character,
          },
        },
        selectionRange: s.selectionRange
          ? {
              start: {
                line: s.selectionRange.start.line,
                character: s.selectionRange.start.character,
              },
              end: {
                line: s.selectionRange.end.line,
                character: s.selectionRange.end.character,
              },
            }
          : undefined,
      }));
    } catch (e) {
      console.warn("Error getting document symbols:", e);
      return [];
    }
  }

  private async getWorkspaceSymbols(args: { query: string }) {
    try {
      const symbols = (await vscode.commands.executeCommand(
        "vscode.executeWorkspaceSymbolProvider",
        args.query,
      )) as vscode.SymbolInformation[];

      if (!symbols) {
        return [];
      }

      return symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        filepath: s.location.uri.toString(),
        range: {
          start: {
            line: s.location.range.start.line,
            character: s.location.range.start.character,
          },
          end: {
            line: s.location.range.end.line,
            character: s.location.range.end.character,
          },
        },
        containerName: s.containerName,
      }));
    } catch (e) {
      console.warn("Error getting workspace symbols:", e);
      return [];
    }
  }
}
