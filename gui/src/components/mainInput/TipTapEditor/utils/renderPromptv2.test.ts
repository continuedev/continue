import { SlashCommandDescWithSource } from "core";
import { setUpTestDir, tearDownTestDir } from "core/test/testDir";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdeMessenger, IIdeMessenger } from "../../../../context/IdeMessenger";
import { getPromptV2ContextRequests } from "./renderPromptv2";

function getTestPromptV2Command(body: string): SlashCommandDescWithSource {
  return {
    prompt: body,
    name: "test-prompt-name",
    description: "test-prompt-description",
    isLegacy: false,
    source: "prompt-file-v2",
  };
}
describe("getPromptV2ContextRequests", () => {
  let ideMessenger: IIdeMessenger;
  const mockGetContextItems = vi.fn().mockResolvedValue([
    {
      name: "custom",
      content: "Custom provider content",
      description: "Custom provider",
    },
  ]);
  beforeEach(async () => {
    // Mock the ideMessenger
    vi.clearAllMocks();
    setUpTestDir();
    ideMessenger = new IdeMessenger();
    vi.spyOn(ideMessenger.ide, "readFile").mockImplementation(() => {
      return Promise.resolve("Example Content");
    });
  });

  afterEach(() => {
    tearDownTestDir();
  });

  it("should render a prompt file with no attachments", async () => {
    const rawContent = "Simple prompt with no attachments";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);

    expect(requests).toHaveLength(0);
  });

  // it("should handle URL attachments", async () => {
  //   const rawContent = "Content with URL @https://example.com";

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(contextItems).toHaveLength(1);
  //   expect(renderedPrompt).toContain("Example Content");
  // });

  // it("should resolve file attachments", async () => {
  //   const rawContent = "Content with file attachment @test.txt";

  //   addToTestDir([["test.txt", "File content"]]);

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(contextItems).toHaveLength(1);
  //   expect(renderedPrompt).toContain("```test.txt\nFile content\n```");
  //   expect(renderedPrompt).toContain("Content with file attachment @test.txt");
  // });

  // it("should handle nested prompt files", async () => {
  //   const rawContent = "Main prompt with nested @nested.prompt";
  //   addToTestDir([
  //     ["nested.prompt", "Nested prompt content with @CustomProvider"],
  //   ]);

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(renderedPrompt).toContain("Custom provider content");
  // });

  // it("should handle custom context providers", async () => {
  //   const rawContent = "Content with custom provider @CustomProvider";

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(contextItems).toHaveLength(1);
  //   expect(renderedPrompt).toContain("Custom provider content");
  //   expect(mockGetContextItems).toHaveBeenCalled();
  // });

  // it("should handle multiple attachments", async () => {
  //   const rawContent = "Content with @file1.txt and @file2.txt";
  //   addToTestDir([
  //     ["file1.txt", "Content 1"],
  //     ["file2.txt", "Content 2"],
  //   ]);

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(contextItems).toHaveLength(2);
  //   expect(renderedPrompt).toContain("```file1.txt\nContent 1\n```");
  //   expect(renderedPrompt).toContain("```file2.txt\nContent 2\n```");
  // });

  // it("should handle failed attachment resolutions gracefully", async () => {
  //   const rawContent = "Content with @nonexistent";

  //   const [contextItems, renderedPrompt] = await getPromptV2ContextAttrs(
  //     rawContent,
  //     extras,
  //   );

  //   expect(contextItems).toHaveLength(0);
  //   expect(renderedPrompt).toBe("Content with @nonexistent\n\nUser input");
  // });
});
