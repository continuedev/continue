import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { walkDirCache } from "../indexing/walkDir";
import { testIde } from "../test/fixtures";
import { addToTestDir, setUpTestDir, tearDownTestDir } from "../test/testDir";
import {
  getAllDotContinueDefinitionFiles,
  LoadAssistantFilesOptions,
} from "./loadLocalAssistants";
describe("ASSISTANTS getAllDotContinueDefinitionFiles with fileExtType option", () => {
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
      [".continue/assistants/config.yaml", "txt content"],
      [".continue/assistants/config.yml", "txt content"],
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
    expect(result).toHaveLength(4);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining([
        "assistant1.yaml",
        "assistant2.yml",
        "config.yaml",
        "config.yml",
      ]),
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
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "config.yml",
    );
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "config.yaml",
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
    expect(result).toHaveLength(5);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining([
        "assistant1.yaml",
        "assistant2.yml",
        "config.yml",
        "config.yaml",
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
    expect(workspaceResult).toHaveLength(4);
    expect(workspaceResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining([
        "assistant1.yaml",
        "assistant2.yml",
        "config.yaml",
        "config.yml",
      ]),
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
    expect(result).toHaveLength(4);
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
    expect(yamlResult).toHaveLength(4);
    expect(yamlResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining([
        "assistant1.yaml",
        "assistant2.yml",
        "config.yaml",
        "config.yml",
      ]),
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

describe("AGENTS getAllDotContinueDefinitionFiles with fileExtType option", () => {
  beforeEach(() => {
    setUpTestDir();
    walkDirCache.invalidate();

    // Add test files to the test directory
    addToTestDir([
      ".continue/agents/",
      [".continue/agents/agent1.yaml", "yaml content 1"],
      [".continue/agents/agent2.yml", "yaml content 2"],
      [".continue/agents/agent3.md", "markdown content 1"],
      [".continue/agents/agent4.txt", "txt content"],
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
      "agents",
    );
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["agent1.yaml", "agent2.yml"]),
    );
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "agent3.md",
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
      "agents",
    );
    expect(result).toHaveLength(1);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(["agent3.md"]);
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "agent1.yaml",
    );
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "agent2.yml",
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
      "agents",
    );
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["agent1.yaml", "agent2.yml", "agent3.md"]),
    );
    // Should not include .txt files
    expect(result.map((f) => f.path.split("/").pop())).not.toContain(
      "agent4.txt",
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
      "agents",
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
      "agents",
    );
    expect(workspaceResult).toHaveLength(2);
    expect(workspaceResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["agent1.yaml", "agent2.yml"]),
    );
  });

  it("should return empty array when no files match the specified extension type", async () => {
    // Create a test directory with only non-matching files
    tearDownTestDir();
    walkDirCache.invalidate();
    setUpTestDir();
    addToTestDir([
      ".continue/agents/",
      [".continue/agents/nonmatch1.txt", "txt content"],
      [".continue/agents/nonmatch2.json", "json content"],
    ]);

    const options: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,

      fileExtType: "yaml",
    };

    const result = await getAllDotContinueDefinitionFiles(
      testIde,
      options,
      "agents",
    );
    expect(result).toHaveLength(0);
  });

  it("should handle directories that don't exist", async () => {
    // Create a clean test directory without the agents folder
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
      "agents",
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
      "agents",
    );
    expect(result).toHaveLength(2);
    const yamlFile = result.find((f) => f.path.includes("agent1.yaml"));
    expect(yamlFile?.content).toBe("yaml content 1");
  });

  it("should filter by file extension case sensitively", async () => {
    // Add files with uppercase extensions
    addToTestDir([
      [".continue/agents/agent5.YAML", "uppercase yaml"],
      [".continue/agents/agent6.YML", "uppercase yml"],
      [".continue/agents/agent7.MD", "uppercase md"],
    ]);

    const yamlOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "yaml",
    };

    const yamlResult = await getAllDotContinueDefinitionFiles(
      testIde,
      yamlOptions,
      "agents",
    );
    // Should only get lowercase extensions (current implementation)
    expect(yamlResult).toHaveLength(2);
    expect(yamlResult.map((f) => f.path.split("/").pop())).toEqual(
      expect.arrayContaining(["agent1.yaml", "agent2.yml"]),
    );
    expect(yamlResult.map((f) => f.path.split("/").pop())).not.toContain(
      "agent5.YAML",
    );

    const markdownOptions: LoadAssistantFilesOptions = {
      includeGlobal: false,
      includeWorkspace: true,
      fileExtType: "markdown",
    };

    const markdownResult = await getAllDotContinueDefinitionFiles(
      testIde,
      markdownOptions,
      "agents",
    );
    expect(markdownResult).toHaveLength(1);
    expect(markdownResult.map((f) => f.path.split("/").pop())).toEqual([
      "agent3.md",
    ]);
    expect(markdownResult.map((f) => f.path.split("/").pop())).not.toContain(
      "agent7.MD",
    );
  });
});
