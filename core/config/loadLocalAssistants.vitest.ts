import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { walkDirCache } from "../indexing/walkDir";
import { testIde } from "../test/fixtures";
import { addToTestDir, setUpTestDir, tearDownTestDir } from "../test/testDir";
import {
  getAllDotContinueDefinitionFiles,
  LoadAssistantFilesOptions,
} from "./loadLocalAssistants";
describe("getAllDotContinueDefinitionFiles with fileExtType option", () => {
  beforeEach(() => {
    setUpTestDir();
    walkDirCache.invalidate();

    // Add test files to the test directory
    addToTestDir([
      ".continue/assistants/",
      [".continue/assistants/assistant1.yaml", "yaml content 1"],
      [".continue/assistants/assistant2.yml", "yaml content 2"],
      [".continue/assistants/assistant3.md", "markdown content 1"],
      [".continue/assistants/assistant4.txt", "txt content"],
    ]);
  });

  afterEach(() => {
    tearDownTestDir();
    walkDirCache.invalidate();
  });

  it("should return only YAML files when fileExtType is 'yaml'", async () => {
    const options: LoadAssistantFilesOptions = {
      includeGlobal: false, // Only test workspace for simplicity
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["assistant1.yaml", "assistant2.yml"]),
    );
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant3.md",
    );
  });

  it("should return only Markdown files when fileExtType is 'markdown'", async () => {
    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "markdown",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(1);
    expect(result.map((f) => f.path.split("/").pop())).toEqual([
      "assistant3.md",
    ]);
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant1.yaml",
    );
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant2.yml",
    );
  });

  it("should return all supported files when fileExtType is not specified", async () => {
    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      // fileExtType not specified
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining([
        "assistant1.yaml",
        "assistant2.yml",
        "assistant3.md",
      ]),
    );
    // Should not include .txt files
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant4.txt",
    );
  });

  it("should respect includeWorkspace option with fileExtType", async () => {
    // Test with includeWorkspace: false
    const workspaceOffOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: false,
      fileExtType: "yaml",
    };

    const noWorkspaceResult = await getAllDotContinueDefinitionFiles(
      testIde,
      workspaceOffOptions,
      "assistants",
    );
    expect(noWorkspaceResult).toHaveLength(0);

    // Test with includeWorkspace: true
    const workspaceOnOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const workspaceResult = await getAllDotContinueDefinitionFiles(
      testIde,
      workspaceOnOptions,
      "assistants",
    );
    expect(workspaceResult).toHaveLength(2);
    expect(workspaceResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["assistant1.yaml", "assistant2.yml"]),
    );
  });

  it("should return empty array when no files match the specified extension type", async () => {
    // Create a test directory with only non-matching files
    tearDownTestDir();
    walkDirCache.invalidate();
    setUpTestDir();
    addToTestDir([
      ".continue/assistants/",
      [".continue/assistants/nonmatch1.txt", "txt content"],
      [".continue/assistants/nonmatch2.json", "json content"],
    ]);

    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,

      fileExtType: "yaml",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(0);
  });

  it("should handle directories that don't exist", async () => {
    // Create a clean test directory without the assistants folder
    tearDownTestDir();
    setUpTestDir();

    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(0);
  });

  it("should return correct file content", async () => {
    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "assistants",
    );
    expect(result).toHaveLength(2);
    const yamlFile = result.find((f) => f.path.includes("assistant1.yaml"));
    expect(yamlFile?.content).toBe("yaml content 1");
  });

  it("should filter by file extension case sensitively", async () => {
    // Add files with uppercase extensions
    addToTestDir([
      [".continue/assistants/assistant5.YAML", "uppercase yaml"],
      [".continue/assistants/assistant6.YML", "uppercase yml"],
      [".continue/assistants/assistant7.MD", "uppercase md"],
    ]);

    const yamlOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const yamlResult = await getAllDotContinueDefinitionFiles(
      testIde,
      yamlOptions,
      "assistants",
    );
    // Should only get lowercase extensions (current implementation)
    expect(yamlResult).toHaveLength(2);
    expect(yamlResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["assistant1.yaml", "assistant2.yml"]),
    );
    expect(yamlResult.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant5.YAML",
    );

    const markdownOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "markdown",
    };

    const markdownResult = await getAllDotContinueDefinitionFiles(
      testIde,
      markdownOptions,
      "assistants",
    );
    expect(markdownResult).toHaveLength(1);
    expect(markdownResult.map((f) => f.path.split("/").pop())).toEqual([
      "assistant3.md",
    ]);
    expect(markdownResult.map((f) => f.path.split("/").pop())).not.toContain(
      "assistant7.MD",
    );
  });
});
