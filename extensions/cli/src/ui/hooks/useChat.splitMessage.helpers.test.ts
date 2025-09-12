import type { ChatHistoryItem } from "core/index.js";

import { splitMessageContent } from "./useChat.splitMessage.helpers.js";

describe("useChat.splitMessage.helpers", () => {
  describe("splitMessageContent", () => {
    it("handles simple string content", () => {
      const content = "Hello world";
      const results = splitMessageContent(content, "user", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.content).toBe("Hello world");
      expect(results[0].message.role).toBe("user");
      expect(results[0].splitMessage).toBeUndefined(); // Single row, no split metadata
    });

    it("splits long content into multiple rows", () => {
      const longText =
        "This is a very long message that should be split across multiple terminal rows when it exceeds the available width";
      const results = splitMessageContent(longText, "user", [], 30);

      expect(results.length).toBeGreaterThan(1);

      // Check split metadata
      expect(results[0].splitMessage?.isFirstRow).toBe(true);
      expect(results[0].splitMessage?.isLastRow).toBe(false);
      expect(results[results.length - 1].splitMessage?.isFirstRow).toBe(false);
      expect(results[results.length - 1].splitMessage?.isLastRow).toBe(true);

      // All should have same total rows
      const totalRows = results[0].splitMessage?.totalRows;
      results.forEach((result, idx) => {
        expect(result.splitMessage?.totalRows).toBe(totalRows);
        expect(result.splitMessage?.rowIndex).toBe(idx);
      });
    });

    it("handles content with newlines", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const results = splitMessageContent(content, "user", [], 80);

      expect(results).toHaveLength(3);
      expect(results[0].splitMessage?.isFirstRow).toBe(true);
      expect(results[1].splitMessage?.isFirstRow).toBe(false);
      expect(results[1].splitMessage?.isLastRow).toBe(false);
      expect(results[2].splitMessage?.isLastRow).toBe(true);
    });

    it("processes assistant messages with markdown into styled segments", () => {
      const content = "This is **bold** text.";
      const results = splitMessageContent(content, "assistant", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].styledSegments).toBeDefined();
      expect(results[0].styledSegments?.length).toBeGreaterThan(1);

      // Should have segments for the markdown content
      expect(results[0].styledSegments).toHaveLength(3);
      expect(results[0].styledSegments?.[0].text).toBe("This is ");
      expect(results[0].styledSegments?.[1].text).toBe(" bold");
      expect(results[0].styledSegments?.[1].styling.bold).toBe(true);
      expect(results[0].styledSegments?.[2].text).toBe("  text.");
    });

    it("handles array content (MessagePart[])", () => {
      const content = [
        { type: "text", text: "Here is an image: " },
        { type: "imageUrl", imageUrl: { url: "data:image/png;base64,..." } },
        { type: "text", text: " and some text" },
      ] as any[];

      const results = splitMessageContent(content, "user", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.content).toBe(
        "Here is an image: [Image #1] and some text",
      );
    });

    it("handles multiple images in array content", () => {
      const content = [
        { type: "text", text: "Image 1: " },
        { type: "imageUrl", imageUrl: { url: "data:image/png;base64,..." } },
        { type: "text", text: " Image 2: " },
        { type: "imageUrl", imageUrl: { url: "data:image/png;base64,..." } },
      ] as any[];

      const results = splitMessageContent(content, "user", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.content).toBe(
        "Image 1: [Image #1] Image 2: [Image #2]",
      );
    });

    it("handles non-string, non-array content", () => {
      const content = { customType: "some object" } as any;
      const results = splitMessageContent(content, "user", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.content).toBe(JSON.stringify(content));
    });

    it("preserves contextItems", () => {
      const contextItems: ChatHistoryItem["contextItems"] = [
        {
          name: "test.js",
          content: "test content",
          id: { providerTitle: "file", itemId: "test-id" },
          description: "test file",
        },
      ];

      const results = splitMessageContent(
        "Test message",
        "user",
        contextItems,
        80,
      );

      expect(results).toHaveLength(1);
      expect(results[0].contextItems).toBe(contextItems);
    });

    it("handles empty content", () => {
      const results = splitMessageContent("", "user", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.content).toBe("");
      expect(results[0].splitMessage).toBeUndefined();
    });

    it("handles system messages", () => {
      const content = "System message content";
      const results = splitMessageContent(content, "system", [], 80);

      expect(results).toHaveLength(1);
      expect(results[0].message.role).toBe("system");
      expect(results[0].message.content).toBe("System message content");
    });

    it("splits assistant messages with complex markdown", () => {
      const content = `# Heading

This is **bold** and *italic* text.

\`\`\`javascript
console.log("code block");
\`\`\`

More text here.`;

      const results = splitMessageContent(content, "assistant", [], 40);

      expect(results.length).toBeGreaterThan(1);

      // All results should have styled segments
      results.forEach((result) => {
        expect(result.styledSegments).toBeDefined();
      });

      // First row should be marked as first
      expect(results[0].splitMessage?.isFirstRow).toBe(true);

      // Last row should be marked as last
      expect(results[results.length - 1].splitMessage?.isLastRow).toBe(true);
    });

    it("handles very narrow terminal width", () => {
      const content = "supercalifragilisticexpialidocious";
      const results = splitMessageContent(content, "user", [], 10);

      expect(results.length).toBeGreaterThan(1);

      // Should split the long word across multiple rows
      const totalContent = results.map((r) => r.message.content).join("");
      expect(totalContent).toBe(content);
    });

    it("maintains proper row indexing for split messages", () => {
      const content = "A ".repeat(100); // Create long content
      const results = splitMessageContent(content, "user", [], 20);

      expect(results.length).toBeGreaterThan(2);

      results.forEach((result, index) => {
        expect(result.splitMessage?.rowIndex).toBe(index);
        expect(result.splitMessage?.totalRows).toBe(results.length);
      });
    });
  });
});
