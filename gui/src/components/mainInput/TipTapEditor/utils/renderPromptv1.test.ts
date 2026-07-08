import { SlashCommandDescWithSource } from "core";
import { beforeEach, describe, it, vi } from "vitest";
import {
  MockIdeMessenger,
  MockResponseHandler,
} from "../../../../context/MockIdeMessenger";
import { getRenderedV1Prompt } from "./renderPromptv1";

function getTestPromptV1Command(body: string): SlashCommandDescWithSource {
  return {
    prompt: body,
    name: "test-prompt-name",
    description: "test-prompt-description",
    isLegacy: false,
    source: "prompt-file-v1",
  };
}
describe("get rendered v1 prompt file", () => {
  const ideMessenger = new MockIdeMessenger();
  const firstDir = ideMessenger.responses["getWorkspaceDirs"]?.[0] ?? "";
  const customGetContextItems: MockResponseHandler<
    "context/getContextItems"
  > = async ({ name }) => {
    if (name === "diff") {
      return [
        {
          id: {
            itemId: "id",
            providerTitle: "diff",
          },
          name: "name",
          description: "description",
          content: "Diff provider content",
        },
      ];
    }
    return [];
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    ideMessenger.resetMocks();
  });

  it("should render a prompt file with no attachments or templated input", async () => {
    const rawContent = "Simple prompt with no attachments";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe("Simple prompt with no attachments\n\nUser input");
  });

  it("should render a prompt file templated input", async () => {
    const rawContent = "{{{ input }}} Simple prompt with no attachments";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe("User input Simple prompt with no attachments");
  });

  it("Should handle file attachments", async () => {
    ideMessenger.responses["readFile"] = "Test file content";
    const rawContent = "Content with URL {{{ testFile.txt }}}";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe("Content with URL Test file content\n\nUser input");
  });

  it("should handle supported providers", async () => {
    ideMessenger.responseHandlers["context/getContextItems"] =
      customGetContextItems;
    const rawContent = "Tell me about {{{ diff }}} please";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe(
      "Tell me about Diff provider content please\n\nUser input",
    );
  });

  it("should render file read errors within prompt", async () => {
    // Mock console.error to prevent error output during test
    const originalConsoleError = console.error;
    console.error = vi.fn();

    ideMessenger.responses["fileExists"] = false;
    // Mock readFile to throw an error for nonexistent files
    ideMessenger.responseHandlers["readFile"] = async (filepath) => {
      throw new Error(`File not found: ${filepath}`);
    };
    const rawContent = "Content with provider {{{ nonexistent }}}";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe(
      `Content with provider [Error reading file "nonexistent"]\n\nUser input`,
    );

    // Restore console.error
    console.error = originalConsoleError;
  });

  it("should handle multiple attachments", async () => {
    ideMessenger.responseHandlers["context/getContextItems"] =
      customGetContextItems;
    ideMessenger.responses["readFile"] = "Test file content";
    const rawContent = "Content with {{{ diff }}} and {{{ file.txt }}}";
    const command = getTestPromptV1Command(rawContent);
    const rendered = await getRenderedV1Prompt(
      ideMessenger,
      command,
      "User input",
      [],
    );
    expect(rendered).toBe(
      "Content with Diff provider content and Test file content\n\nUser input",
    );
  });
});
