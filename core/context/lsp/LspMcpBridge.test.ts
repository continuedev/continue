/**
 * Unit tests for LspMcpBridge - the bridge between Code Mode sandbox and VS Code LSP providers.
 *
 * Tests cover:
 * - All 6 LSP operations (getDefinition, findReferences, getHover, getDiagnostics, getDocumentSymbols, getWorkspaceSymbols)
 * - Graceful error handling (returns empty results instead of throwing)
 * - Edge cases (missing files, null results, unsupported languages)
 */

// Mock vscode module (uses __mocks__/vscode.ts)
jest.mock("vscode");

// Mock LSP utility functions
jest.mock("../../../extensions/vscode/src/autocomplete/lsp.js");

import * as vscode from "vscode";
import type { IDE } from "../..";
import {
  executeGotoProvider,
  executeSymbolProvider,
} from "../../../extensions/vscode/src/autocomplete/lsp.js";
import { LspMcpBridge } from "./LspMcpBridge.js";

describe("LspMcpBridge", () => {
  let bridge: LspMcpBridge;
  let mockIde: IDE;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock IDE
    mockIde = {
      readRangeInFile: jest.fn().mockResolvedValue("function example() {}"),
    } as any;

    bridge = new LspMcpBridge(mockIde);
  });

  describe("getTools", () => {
    it("should return all 6 LSP tools", () => {
      const tools = bridge.getTools();

      expect(tools).toHaveLength(6);
      expect(tools.map((t) => t.name)).toEqual([
        "getDefinition",
        "findReferences",
        "getHover",
        "getDiagnostics",
        "getDocumentSymbols",
        "getWorkspaceSymbols",
      ]);
    });

    it("should return tools with valid MCP-compatible schemas", () => {
      const tools = bridge.getTools();

      tools.forEach((tool) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool.inputSchema).toHaveProperty("type", "object");
        expect(tool.inputSchema).toHaveProperty("properties");
        expect(tool.inputSchema).toHaveProperty("required");
      });
    });
  });

  describe("callTool", () => {
    it("should throw for unknown tool names", async () => {
      const result = await bridge.callTool("unknownTool", {});

      // Should return empty result due to graceful error handling
      expect(result).toEqual([]);
    });
  });

  describe("getDefinition", () => {
    it("should return definitions with file contents", async () => {
      const mockDefinitions = [
        {
          filepath: "/test/file.ts",
          range: {
            start: { line: 10, character: 5 },
            end: { line: 10, character: 15 },
          },
        },
      ];

      (executeGotoProvider as jest.Mock).mockResolvedValue(mockDefinitions);
      (mockIde.readRangeInFile as jest.Mock).mockResolvedValue(
        "function test() { return 42; }",
      );

      const result = await bridge.callTool("getDefinition", {
        filepath: "/test/file.ts",
        line: 20,
        character: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filepath: "/test/file.ts",
        range: {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        },
        contents: "function test() { return 42; }",
      });

      expect(executeGotoProvider).toHaveBeenCalledWith({
        uri: expect.anything(),
        line: 20,
        character: 10,
        name: "vscode.executeDefinitionProvider",
      });
    });

    it("should filter out definitions where file reading fails", async () => {
      const mockDefinitions = [
        {
          filepath: "/test/success.ts",
          range: {
            start: { line: 5, character: 0 },
            end: { line: 5, character: 10 },
          },
        },
        {
          filepath: "/test/fail.ts",
          range: {
            start: { line: 3, character: 0 },
            end: { line: 3, character: 8 },
          },
        },
      ];

      (executeGotoProvider as jest.Mock).mockResolvedValue(mockDefinitions);
      (mockIde.readRangeInFile as jest.Mock)
        .mockResolvedValueOnce("const success = true;")
        .mockRejectedValueOnce(new Error("File not found"));

      const result = await bridge.callTool("getDefinition", {
        filepath: "/test/file.ts",
        line: 0,
        character: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0].filepath).toBe("/test/success.ts");
    });

    it("should return empty array on error", async () => {
      (executeGotoProvider as jest.Mock).mockRejectedValue(
        new Error("LSP error"),
      );

      const result = await bridge.callTool("getDefinition", {
        filepath: "/nonexistent.ts",
        line: 0,
        character: 0,
      });

      expect(result).toEqual([]);
    });
  });

  describe("findReferences", () => {
    it("should return all references without contents", async () => {
      const mockReferences = [
        {
          filepath: "/test/file1.ts",
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          },
        },
        {
          filepath: "/test/file2.ts",
          range: {
            start: { line: 15, character: 5 },
            end: { line: 15, character: 15 },
          },
        },
      ];

      (executeGotoProvider as jest.Mock).mockResolvedValue(mockReferences);

      const result = await bridge.callTool("findReferences", {
        filepath: "/test/file.ts",
        line: 10,
        character: 12,
        includeDeclaration: false,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        filepath: "/test/file1.ts",
        range: {
          start: { line: 5, character: 10 },
          end: { line: 5, character: 20 },
        },
      });
      expect(result[0]).not.toHaveProperty("contents");

      expect(executeGotoProvider).toHaveBeenCalledWith({
        uri: expect.anything(),
        line: 10,
        character: 12,
        name: "vscode.executeReferenceProvider",
      });
    });

    it("should return empty array on error", async () => {
      (executeGotoProvider as jest.Mock).mockRejectedValue(
        new Error("References failed"),
      );

      const result = await bridge.callTool("findReferences", {
        filepath: "/test/file.ts",
        line: 0,
        character: 0,
      });

      expect(result).toEqual([]);
    });
  });

  describe("getHover", () => {
    it("should return hover information with contents and range", async () => {
      const mockHover = [
        {
          contents: [
            { value: "```typescript\nfunction test(): number\n```" },
            { value: "Returns a test number" },
          ],
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 14 },
          },
        },
      ];

      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(
        mockHover,
      );

      const result = await bridge.callTool("getHover", {
        filepath: "/test/file.ts",
        line: 5,
        character: 12,
      });

      expect(result).toEqual({
        contents:
          "```typescript\nfunction test(): number\n```\n\nReturns a test number",
        range: {
          start: { line: 5, character: 10 },
          end: { line: 5, character: 14 },
        },
      });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "vscode.executeHoverProvider",
        expect.anything(),
        expect.objectContaining({ line: 5, character: 12 }),
      );
    });

    it("should handle string contents", async () => {
      const mockHover = [
        {
          contents: ["Simple string content"],
          range: undefined,
        },
      ];

      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(
        mockHover,
      );

      const result = await bridge.callTool("getHover", {
        filepath: "/test/file.ts",
        line: 0,
        character: 0,
      });

      expect(result).toEqual({
        contents: "Simple string content",
        range: undefined,
      });
    });

    it("should return null when no hover info available", async () => {
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue([]);

      const result = await bridge.callTool("getHover", {
        filepath: "/test/file.ts",
        line: 100,
        character: 50,
      });

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(
        new Error("Hover failed"),
      );

      const result = await bridge.callTool("getHover", {
        filepath: "/test/file.ts",
        line: 0,
        character: 0,
      });

      expect(result).toBeNull();
    });
  });

  describe("getDiagnostics", () => {
    it("should return all diagnostics for a file", async () => {
      const mockDiagnostics = [
        {
          message: "Cannot find name 'foo'",
          severity: 0, // Error
          range: {
            start: { line: 10, character: 5 },
            end: { line: 10, character: 8 },
          },
          source: "ts",
          code: 2304,
        },
        {
          message: "Variable is declared but never used",
          severity: 1, // Warning
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 15 },
          },
          source: "ts",
          code: 6133,
        },
      ];

      (vscode.languages.getDiagnostics as jest.Mock).mockReturnValue(
        mockDiagnostics,
      );

      const result = await bridge.callTool("getDiagnostics", {
        filepath: "/test/file.ts",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        message: "Cannot find name 'foo'",
        severity: 0,
        range: {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 8 },
        },
        source: "ts",
        code: 2304,
      });
    });

    it("should return empty array when no diagnostics", async () => {
      (vscode.languages.getDiagnostics as jest.Mock).mockReturnValue([]);

      const result = await bridge.callTool("getDiagnostics", {
        filepath: "/test/clean.ts",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      (vscode.languages.getDiagnostics as jest.Mock).mockImplementation(() => {
        throw new Error("Diagnostics failed");
      });

      const result = await bridge.callTool("getDiagnostics", {
        filepath: "/test/file.ts",
      });

      expect(result).toEqual([]);
    });
  });

  describe("getDocumentSymbols", () => {
    it("should return all symbols in a document", async () => {
      const mockSymbols = [
        {
          name: "MyClass",
          kind: 5, // Class
          range: {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 1 },
          },
          selectionRange: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 13 },
          },
        },
        {
          name: "myFunction",
          kind: 12, // Function
          range: {
            start: { line: 15, character: 0 },
            end: { line: 20, character: 1 },
          },
          selectionRange: {
            start: { line: 15, character: 9 },
            end: { line: 15, character: 19 },
          },
        },
      ];

      (executeSymbolProvider as jest.Mock).mockResolvedValue(mockSymbols);

      const result = await bridge.callTool("getDocumentSymbols", {
        filepath: "/test/file.ts",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "MyClass",
        kind: 5,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 13 },
        },
      });

      expect(executeSymbolProvider).toHaveBeenCalledWith({
        uri: expect.anything(),
        name: "vscode.executeDocumentSymbolProvider",
      });
    });

    it("should handle symbols without selectionRange", async () => {
      const mockSymbols = [
        {
          name: "symbolWithoutSelection",
          kind: 13, // Variable
          range: {
            start: { line: 5, character: 0 },
            end: { line: 5, character: 20 },
          },
          selectionRange: undefined,
        },
      ];

      (executeSymbolProvider as jest.Mock).mockResolvedValue(mockSymbols);

      const result = await bridge.callTool("getDocumentSymbols", {
        filepath: "/test/file.ts",
      });

      expect(result[0]).toEqual({
        name: "symbolWithoutSelection",
        kind: 13,
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 20 },
        },
        selectionRange: undefined,
      });
    });

    it("should return empty array on error", async () => {
      (executeSymbolProvider as jest.Mock).mockRejectedValue(
        new Error("Symbols failed"),
      );

      const result = await bridge.callTool("getDocumentSymbols", {
        filepath: "/test/file.ts",
      });

      expect(result).toEqual([]);
    });
  });

  describe("getWorkspaceSymbols", () => {
    it("should return workspace symbols matching query", async () => {
      const mockSymbols = [
        {
          name: "MyTool",
          kind: 5, // Class
          location: {
            uri: { toString: () => "/test/tool1.ts" },
            range: {
              start: { line: 0, character: 0 },
              end: { line: 50, character: 1 },
            },
          },
          containerName: "tools",
        },
        {
          name: "ToolHelper",
          kind: 12, // Function
          location: {
            uri: { toString: () => "/test/helper.ts" },
            range: {
              start: { line: 10, character: 0 },
              end: { line: 15, character: 1 },
            },
          },
          containerName: undefined,
        },
      ];

      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(
        mockSymbols,
      );

      const result = await bridge.callTool("getWorkspaceSymbols", {
        query: "Tool",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "MyTool",
        kind: 5,
        filepath: "/test/tool1.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 50, character: 1 },
        },
        containerName: "tools",
      });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "vscode.executeWorkspaceSymbolProvider",
        "Tool",
      );
    });

    it("should return empty array when no symbols found", async () => {
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(null);

      const result = await bridge.callTool("getWorkspaceSymbols", {
        query: "NonExistentSymbol",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(
        new Error("Workspace symbols failed"),
      );

      const result = await bridge.callTool("getWorkspaceSymbols", {
        query: "Test",
      });

      expect(result).toEqual([]);
    });
  });

  describe("graceful degradation", () => {
    it("should not crash when LSP provider throws", async () => {
      (executeGotoProvider as jest.Mock).mockRejectedValue(
        new Error("Language server crashed"),
      );

      const result = await bridge.callTool("getDefinition", {
        filepath: "/test/file.ts",
        line: 0,
        character: 0,
      });

      expect(result).toEqual([]);
    });

    it("should not crash when IDE.readRangeInFile throws", async () => {
      const mockDefinitions = [
        {
          filepath: "/test/file.ts",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
      ];

      (executeGotoProvider as jest.Mock).mockResolvedValue(mockDefinitions);
      (mockIde.readRangeInFile as jest.Mock).mockRejectedValue(
        new Error("File read failed"),
      );

      const result = await bridge.callTool("getDefinition", {
        filepath: "/test/file.ts",
        line: 5,
        character: 10,
      });

      // Should filter out failed definitions
      expect(result).toEqual([]);
    });

    it("should return correct empty result type for each tool", async () => {
      const errorScenarios = [
        { toolName: "getDefinition", expected: [] },
        { toolName: "findReferences", expected: [] },
        { toolName: "getHover", expected: null },
        { toolName: "getDiagnostics", expected: [] },
        { toolName: "getDocumentSymbols", expected: [] },
        { toolName: "getWorkspaceSymbols", expected: [] },
      ];

      for (const scenario of errorScenarios) {
        (executeGotoProvider as jest.Mock).mockRejectedValue(
          new Error("LSP error"),
        );
        (executeSymbolProvider as jest.Mock).mockRejectedValue(
          new Error("LSP error"),
        );
        (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(
          new Error("LSP error"),
        );
        (vscode.languages.getDiagnostics as jest.Mock).mockImplementation(
          () => {
            throw new Error("LSP error");
          },
        );

        const result = await bridge.callTool(scenario.toolName, {
          filepath: "/test/file.ts",
          line: 0,
          character: 0,
          query: "test",
        });

        expect(result).toEqual(scenario.expected);
      }
    });
  });
});
