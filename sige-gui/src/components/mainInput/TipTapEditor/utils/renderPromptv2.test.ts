import { SlashCommandDescWithSource } from "core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../../../../context/MockIdeMessenger";
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
  const ideMessenger = new MockIdeMessenger();
  const firstDir = ideMessenger.responses["getWorkspaceDirs"]?.[0] ?? "";
  beforeEach(async () => {
    vi.clearAllMocks();
    ideMessenger.resetMocks();
  });

  it("should render a prompt file with no attachments", async () => {
    const rawContent = "Simple prompt with no attachments";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);
    expect(requests).toHaveLength(0);
  });

  it("should handle URL attachments", async () => {
    const rawContent = "Content with URL @https://example.com";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);
    expect(requests).toHaveLength(1);
    expect(requests[0].provider).toBe("url");
    expect(requests[0].query).toBe("https://example.com");
  });

  it("should resolve file attachments", async () => {
    const rawContent = "Content with file attachment @test.txt";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);

    expect(requests).toHaveLength(1);
    expect(requests[0].provider).toBe("file");
    expect(requests[0].query).toBe(`${firstDir}/test.txt`);
  });

  it("should handle nested prompt files", async () => {
    ideMessenger.responses["readFile"] = "Contents @myfile.txt";
    const rawContent = "Main prompt with nested @test.prompt";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);
    expect(requests).toHaveLength(2);
    expect(requests[0].provider).toBe("file");
    expect(requests[0].query).toBe(`${firstDir}/myfile.txt`);
    expect(requests[1].provider).toBe("file");
    expect(requests[1].query).toBe(`${firstDir}/test.prompt`);
  });

  it("should ignore unsupported providers", async () => {
    ideMessenger.responses["fileExists"] = false;
    const rawContent = "Content with custom provider @unsupported";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);
    expect(requests).toHaveLength(0);
  });

  it("should handle multiple attachments", async () => {
    const rawContent = "Content with @file1.txt and @file2.txt";
    const command = getTestPromptV2Command(rawContent);
    const requests = await getPromptV2ContextRequests(ideMessenger, command);

    expect(requests).toHaveLength(2);
    expect(requests[0].provider).toBe("file");
    expect(requests[0].query).toBe(`${firstDir}/file1.txt`);
    expect(requests[1].provider).toBe("file");
    expect(requests[1].query).toBe(`${firstDir}/file2.txt`);
  });
});
