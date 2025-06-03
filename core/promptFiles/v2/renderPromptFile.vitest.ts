import { ContextProviderExtras, ILLM, RangeInFile } from "../..";
import { testConfigHandler, testIde } from "../../test/fixtures";
import {
  addToTestDir,
  setUpTestDir,
  tearDownTestDir,
} from "../../test/testDir";
import { renderPromptFileV2 } from "./renderPromptFile";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  import("../../context/providers/URLContextProvider"),
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      getUrlContextItems: vi.fn().mockResolvedValue([
        {
          description: "https://example.com",
          content: "Example Content",
          name: "Example site",
          uri: {
            type: "url",
            value: "https://example.com",
          },
        },
      ]),
    };
  },
);

describe("renderPromptFileV2", () => {
  let extras: ContextProviderExtras;
  const mockGetContextItems = vi.fn().mockResolvedValue([
    {
      name: "custom",
      content: "Custom provider content",
      description: "Custom provider",
    },
  ]);
  beforeEach(async () => {
    const { config } = await testConfigHandler.loadConfig();

    // Setup mock extras
    extras = {
      config: {
        ...config!,
        contextProviders: [
          {
            description: {
              type: "normal",
              title: "CustomProvider",
              displayTitle: "Custom Provider",
              description: "A custom context provider",
            },
            loadSubmenuItems: vi.fn().mockResolvedValue([]),
            getContextItems: mockGetContextItems,
          },
        ],
      },
      fullInput: "User input",
      embeddingsProvider: null,
      reranker: null,
      llm: {} as ILLM,
      ide: testIde,
      selectedCode: [] as RangeInFile[],
      fetch: vi.fn(),
    };

    // Clear all mocks
    vi.clearAllMocks();
    setUpTestDir();
  });

  afterEach(() => {
    tearDownTestDir();
  });

  it("should render a prompt file with no attachments", async () => {
    const rawContent = "Simple prompt with no attachments";
    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(0);
    expect(renderedPrompt).toBe(
      "Simple prompt with no attachments\n\nUser input",
    );
  });

  it("should handle URL attachments", async () => {
    const rawContent = "Content with URL @https://example.com";

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(1);
    expect(renderedPrompt).toContain("Example Content");
  });

  it("should resolve file attachments", async () => {
    const rawContent = "Content with file attachment @test.txt";

    addToTestDir([["test.txt", "File content"]]);

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(1);
    expect(renderedPrompt).toContain("```test.txt\nFile content\n```");
    expect(renderedPrompt).toContain("Content with file attachment @test.txt");
  });

  it("should handle nested prompt files", async () => {
    const rawContent = "Main prompt with nested @nested.prompt";
    addToTestDir([
      ["nested.prompt", "Nested prompt content with @CustomProvider"],
    ]);

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(renderedPrompt).toContain("Custom provider content");
  });

  it("should handle custom context providers", async () => {
    const rawContent = "Content with custom provider @CustomProvider";

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(1);
    expect(renderedPrompt).toContain("Custom provider content");
    expect(mockGetContextItems).toHaveBeenCalled();
  });

  it("should handle multiple attachments", async () => {
    const rawContent = "Content with @file1.txt and @file2.txt";
    addToTestDir([
      ["file1.txt", "Content 1"],
      ["file2.txt", "Content 2"],
    ]);

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(2);
    expect(renderedPrompt).toContain("```file1.txt\nContent 1\n```");
    expect(renderedPrompt).toContain("```file2.txt\nContent 2\n```");
  });

  it("should handle failed attachment resolutions gracefully", async () => {
    const rawContent = "Content with @nonexistent";

    const [contextItems, renderedPrompt] = await renderPromptFileV2(
      rawContent,
      extras,
    );

    expect(contextItems).toHaveLength(0);
    expect(renderedPrompt).toBe("Content with @nonexistent\n\nUser input");
  });
});
