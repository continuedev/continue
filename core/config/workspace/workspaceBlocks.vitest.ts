import { BlockType, RULE_FILE_EXTENSION } from "@continuedev/config-yaml";
import { describe, expect, test } from "vitest";
import { findAvailableFilename, getFileContent } from "./workspaceBlocks";

describe("getFileContent", () => {
  test("returns markdown content for rules block type", () => {
    const result = getFileContent("rules");
    expect(result).toContain("Your rule content");
    expect(result).toContain("A description of your rule");
  });

  test("returns YAML content for non-rules block types", () => {
    const result = getFileContent("models");
    expect(result).toContain("name: New model");
    expect(result).toContain("version: 0.0.1");
    expect(result).toContain("schema: v1");
    expect(result).toContain("models:");
    expect(result).toContain("provider: anthropic");
  });

  test("generates correct content for different block types", () => {
    const contextResult = getFileContent("context");
    expect(contextResult).toContain("name: New context");
    expect(contextResult).toContain("context:");
    expect(contextResult).toContain("provider: file");

    const docsResult = getFileContent("docs");
    expect(docsResult).toContain("name: New doc");
    expect(docsResult).toContain("docs:");
    expect(docsResult).toContain("startUrl: https://docs.continue.dev");

    const promptsResult = getFileContent("prompts");
    expect(promptsResult).toContain("name: New prompt");
    expect(promptsResult).toContain("description: New prompt");
    expect(promptsResult).toContain("invokable: true");
    expect(promptsResult).toContain("thorough suite of unit tests");
    expect(promptsResult).toContain("---"); // Should be markdown with frontmatter

    const mcpResult = getFileContent("mcpServers");
    expect(mcpResult).toContain("name: New MCP server");
    expect(mcpResult).toContain("mcpServers:");
    expect(mcpResult).toContain("command: npx");
  });
});

describe("findAvailableFilename", () => {
  test("returns base filename when it doesn't exist", async () => {
    const mockFileExists = async (uri: string) => false;

    const result = await findAvailableFilename(
      "/workspace/.continue/models",
      "models",
      mockFileExists,
    );

    expect(result).toBe("/workspace/.continue/models/new-model.yaml");
  });

  test("returns filename with counter when base exists", async () => {
    const mockFileExists = async (uri: string) => {
      return uri === "/workspace/.continue/models/new-model.yaml";
    };

    const result = await findAvailableFilename(
      "/workspace/.continue/models",
      "models",
      mockFileExists,
    );

    expect(result).toBe("/workspace/.continue/models/new-model-1.yaml");
  });

  test("increments counter until available filename is found", async () => {
    const existingFiles = new Set([
      "/workspace/.continue/context/new-context.yaml",
      "/workspace/.continue/context/new-context-1.yaml",
      "/workspace/.continue/context/new-context-2.yaml",
    ]);

    const mockFileExists = async (uri: string) => {
      return existingFiles.has(uri);
    };

    const result = await findAvailableFilename(
      "/workspace/.continue/context",
      "context",
      mockFileExists,
    );

    expect(result).toBe("/workspace/.continue/context/new-context-3.yaml");
  });

  test("handles different block types correctly with proper extensions", async () => {
    const mockFileExists = async (uri: string) => false;

    const testCases: Array<{ blockType: BlockType; expected: string }> = [
      { blockType: "models", expected: "/test/new-model.yaml" },
      { blockType: "context", expected: "/test/new-context.yaml" },
      { blockType: "rules", expected: `/test/new-rule.${RULE_FILE_EXTENSION}` },
      { blockType: "docs", expected: "/test/new-doc.yaml" },
      { blockType: "prompts", expected: "/test/new-prompt.md" },
      { blockType: "mcpServers", expected: "/test/new-mcp-server.yaml" },
    ];

    for (const { blockType, expected } of testCases) {
      const result = await findAvailableFilename(
        "/test",
        blockType,
        mockFileExists,
      );
      expect(result).toBe(expected);
    }
  });

  test("respects custom extension parameter", async () => {
    const mockFileExists = async (uri: string) => false;

    const result = await findAvailableFilename(
      "/test",
      "models",
      mockFileExists,
      "json",
    );

    expect(result).toBe("/test/new-model.json");
  });

  test("handles rules markdown files with counter", async () => {
    const existingFiles = new Set([
      `/workspace/.continue/rules/new-rule.${RULE_FILE_EXTENSION}`,
      `/workspace/.continue/rules/new-rule-1.${RULE_FILE_EXTENSION}`,
    ]);

    const mockFileExists = async (uri: string) => {
      return existingFiles.has(uri);
    };

    const result = await findAvailableFilename(
      "/workspace/.continue/rules",
      "rules",
      mockFileExists,
    );

    expect(result).toBe(
      `/workspace/.continue/rules/new-rule-2.${RULE_FILE_EXTENSION}`,
    );
  });

  test("handles large counter values", async () => {
    const existingFiles = new Set(
      Array.from({ length: 100 }, (_, i) =>
        i === 0
          ? "/workspace/.continue/prompts/new-prompt.md"
          : `/workspace/.continue/prompts/new-prompt-${i}.md`,
      ),
    );

    const mockFileExists = async (uri: string) => {
      return existingFiles.has(uri);
    };

    const result = await findAvailableFilename(
      "/workspace/.continue/prompts",
      "prompts",
      mockFileExists,
    );

    expect(result).toBe("/workspace/.continue/prompts/new-prompt-100.md");
  });
});
