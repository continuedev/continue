import { JSONContent } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { expect, test, vi } from "vitest";
import { processEditorContent } from "./processEditorContent";

describe("processEditorContent", () => {
  // Create some reusable test data
  const createContextItem = (
    content: string,
    description: string,
    fileUri?: string,
    editing?: boolean,
  ): ContextItemWithId => ({
    id: { providerTitle: "test", itemId: "test-id" },
    content,
    description,
    name: "Test Item",
    editing,
    uri: fileUri ? { type: "file", value: fileUri } : undefined,
  });

  test("processEditorContent should return empty arrays when content is empty", () => {
    // Empty editor state
    const emptyEditorState: JSONContent = {
      type: "doc",
      content: [],
    };

    const result = processEditorContent(emptyEditorState);

    expect(result.parts).toEqual([]);
    expect(result.contextRequests).toEqual([]);
    expect(result.selectedCode).toEqual([]);
    expect(result.slashCommandName).toBeUndefined();
  });

  test("processEditorContent should process text paragraphs", () => {
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello world",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is another paragraph",
            },
          ],
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Hello world\nThis is another paragraph",
      },
    ]);
    expect(result.contextRequests).toEqual([]);
    expect(result.selectedCode).toEqual([]);
  });

  test("processEditorContent should detect slash commands", () => {
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "prompt-block",
          attrs: {
            item: {
              name: "test-command",
            },
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Some text after the prompt",
            },
          ],
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.slashCommandName).toBe("test-command");
    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Some text after the prompt",
      },
    ]);
  });

  test("processEditorContent should handle mentions and collect context requests", () => {
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello ",
            },
            {
              type: "mention",
              attrs: {
                id: "fileSearch",
                label: "@fileSearch",
                itemType: "contextProvider",
              },
            },
            {
              type: "text",
              text: " and also ",
            },
            {
              type: "mention",
              attrs: {
                id: "github",
                label: "@github",
                itemType: "contextProvider",
              },
            },
          ],
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Hello @fileSearch and also @github",
      },
    ]);
    expect(result.contextRequests).toEqual([
      { provider: "fileSearch" },
      { provider: "github" },
    ]);
  });

  test("processEditorContent should handle code blocks", () => {
    const codeItem = createContextItem(
      "function test() {\n  return 'hello';\n}",
      "a description",
      "file:///example.js",
    );

    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Check this code:",
            },
          ],
        },
        {
          type: "code-block",
          attrs: {
            item: codeItem,
          },
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Check this code:\n\n```js example.js (1-1)\nfunction test() {\n  return 'hello';\n}\n```\n",
      },
    ]);
    expect(result.selectedCode).toHaveLength(1);
    expect(result.selectedCode[0].filepath).toBe("file:///example.js");
  });

  test("processEditorContent should not include editing code blocks in the text", () => {
    const editingCodeItem = createContextItem(
      "function test() {\n  return 'hello';\n}",
      "a description",
      "file:///editing.js",
      true, // Set editing to true
    );

    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Edit this code:",
            },
          ],
        },
        {
          type: "code-block",
          attrs: {
            item: editingCodeItem,
          },
        },
      ],
    };

    const result = processEditorContent(editorState);

    // The code block should not be included in parts because it's marked as editing
    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Edit this code:",
      },
    ]);

    // But it should still be in selectedCode
    expect(result.selectedCode).toHaveLength(1);
    expect(result.selectedCode[0].filepath).toBe("file:///editing.js");
  });

  test("processEditorContent should handle images", () => {
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Here's an image:",
            },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/image.png",
          },
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Here's an image:",
      },
      {
        type: "imageUrl",
        imageUrl: { url: "https://example.com/image.png" },
      },
    ]);
  });

  test("processEditorContent should handle complex content with multiple elements", () => {
    const codeItem = createContextItem(
      "const x = 42;",
      "a description",
      "file:///script.ts",
    );

    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "prompt-block",
          attrs: {
            item: {
              name: "explain",
            },
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Please explain this code and also check ",
            },
            {
              type: "mention",
              attrs: {
                id: "related",
                label: "@related",
                itemType: "similarFiles",
              },
            },
          ],
        },
        {
          type: "code-block",
          attrs: {
            item: codeItem,
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "What does this constant do?",
            },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/diagram.png",
          },
        },
      ],
    };

    const result = processEditorContent(editorState);

    expect(result.slashCommandName).toBe("explain");
    expect(result.contextRequests).toEqual([{ provider: "similarFiles" }]);
    expect(result.selectedCode).toHaveLength(1);
    expect(result.selectedCode[0].filepath).toBe("file:///script.ts");

    // `\n\n\`\`\`${extension} ${relativePathOrBasename}\n${contextItem.content}\n\`\`\`\n`;

    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Please explain this code and also check @related\n\n```ts script.ts (1-1)\nconst x = 42;\n```\n\nWhat does this constant do?",
      },
      {
        type: "imageUrl",
        imageUrl: { url: "https://example.com/diagram.png" },
      },
    ]);
  });

  test("processEditorContent should merge consecutive text parts", () => {
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "First paragraph",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Second paragraph",
            },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/image.png",
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Third paragraph",
            },
          ],
        },
      ],
    };

    const result = processEditorContent(editorState);

    // First two paragraphs should be merged, but the third should be separate
    // because there's an image in between
    expect(result.parts).toEqual([
      {
        type: "text",
        text: "First paragraph\nSecond paragraph",
      },
      {
        type: "imageUrl",
        imageUrl: { url: "https://example.com/image.png" },
      },
      {
        type: "text",
        text: "Third paragraph",
      },
    ]);
  });

  test("processEditorContent should handle unexpected content types gracefully", () => {
    // Testing with an unknown node type
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Normal text",
            },
          ],
        },
        {
          type: "unknown-type", // This type doesn't exist
          content: [
            {
              type: "text",
              text: "This should be ignored",
            },
          ],
        },
      ],
    };

    // Spy on console.warn to verify it's called
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = processEditorContent(editorState);

    // Only the normal paragraph should be processed
    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Normal text",
      },
    ]);

    // Console.warn should be called for the unknown type
    expect(warnSpy).toHaveBeenCalledWith(
      "Unexpected content type",
      "unknown-type",
    );

    warnSpy.mockRestore();
  });

  test("processEditorContent should handle missing attrs in code blocks", () => {
    // Testing with a code block that has no item attribute
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "code-block",
          // Missing attrs property
        },
      ],
    };

    // Spy on console.warn to verify it's called
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = processEditorContent(editorState);

    // No parts should be created
    expect(result.parts).toEqual([]);
    expect(result.selectedCode).toEqual([]);

    // Console.warn should be called for the missing item attribute
    expect(warnSpy).toHaveBeenCalledWith("codeBlock has no item attribute");

    warnSpy.mockRestore();
  });

  test("processEditorContent should handle paragraphs with unexpected child types", () => {
    // Testing with a paragraph that has an unknown child type
    const editorState: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Normal text ",
            },
            {
              type: "unknown-child", // This type doesn't exist
              text: "This should be ignored",
            },
          ],
        },
      ],
    };

    // Spy on console.warn to verify it's called
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = processEditorContent(editorState);

    // Only the normal text should be processed
    expect(result.parts).toEqual([
      {
        type: "text",
        text: "Normal text ",
      },
    ]);

    // Console.warn should be called for the unknown child type
    expect(warnSpy).toHaveBeenCalledWith(
      "Unexpected child type",
      "unknown-child",
    );

    warnSpy.mockRestore();
  });
});
