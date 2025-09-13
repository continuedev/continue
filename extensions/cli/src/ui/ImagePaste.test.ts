import { describe, it, expect, beforeEach } from "vitest";

import { TextBuffer } from "./TextBuffer.js";

describe("Image Pasting Functionality", () => {
  let textBuffer: TextBuffer;

  beforeEach(() => {
    textBuffer = new TextBuffer();
  });

  describe("TextBuffer Image Support", () => {
    it("should add image placeholder to text buffer", () => {
      const mockImageBuffer = Buffer.from("fake-image-data");

      const placeholder = textBuffer.addImage(mockImageBuffer);

      expect(placeholder).toBe("[Image #1]");
      expect(textBuffer.text).toBe("[Image #1]");
      expect(textBuffer.getAllImages().size).toBe(1);
      expect(textBuffer.getAllImages().get(placeholder)).toBe(mockImageBuffer);
    });

    it("should handle multiple images with incrementing counters", () => {
      const mockImageBuffer1 = Buffer.from("fake-image-data-1");
      const mockImageBuffer2 = Buffer.from("fake-image-data-2");

      const placeholder1 = textBuffer.addImage(mockImageBuffer1);
      const placeholder2 = textBuffer.addImage(mockImageBuffer2);

      expect(placeholder1).toBe("[Image #1]");
      expect(placeholder2).toBe("[Image #2]");
      expect(textBuffer.text).toBe("[Image #1][Image #2]");
      expect(textBuffer.getAllImages().size).toBe(2);
    });

    it("should clear images when buffer is cleared", () => {
      const mockImageBuffer = Buffer.from("fake-image-data");
      textBuffer.addImage(mockImageBuffer);

      textBuffer.clear();

      expect(textBuffer.getAllImages().size).toBe(0);
      expect(textBuffer.text).toBe("");
    });

    it("should clear only images with clearImages()", () => {
      const mockImageBuffer = Buffer.from("fake-image-data");
      textBuffer.insertText("Some text ");
      textBuffer.addImage(mockImageBuffer);
      textBuffer.insertText(" more text");

      textBuffer.clearImages();

      expect(textBuffer.getAllImages().size).toBe(0);
      expect(textBuffer.text).toContain("Some text");
      expect(textBuffer.text).toContain("[Image #1]");
      expect(textBuffer.text).toContain("more text");
    });
  });

  describe("Message Formatting with Images", () => {
    it("should format message with images correctly", async () => {
      const { formatMessageWithFiles } = await import(
        "./hooks/useChat.helpers.js"
      );

      const message = "Here is an image: [Image #1] and some text";
      const attachedFiles: Array<{ path: string; content: string }> = [];
      const imageMap = new Map([
        ["[Image #1]", Buffer.from("fake-image-data")],
      ]);

      const results = await formatMessageWithFiles(
        message,
        attachedFiles,
        80, // terminalWidth
        imageMap,
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Since we now split messages, let's just check the first result
      const firstResult = results[0];
      expect(firstResult.message.role).toBe("user");

      // The content should now be a string (since each row is split)
      expect(typeof firstResult.message.content).toBe("string");

      // Check that the content contains expected parts (image placeholder or text)
      const allContent = results.map((r) => r.message.content).join("");
      expect(allContent).toContain("Here is an image:");
      expect(allContent).toContain("[Image #1]");
      expect(allContent).toContain("and some text");
    });

    it("should handle message with only text (no images)", async () => {
      const { formatMessageWithFiles } = await import(
        "./hooks/useChat.helpers.js"
      );

      const message = "Just text, no images";
      const attachedFiles: Array<{ path: string; content: string }> = [];

      const results = await formatMessageWithFiles(message, attachedFiles, 80);

      expect(Array.isArray(results)).toBe(true);
      const allContent = results.map((r) => r.message.content).join("");
      expect(results[0].message.role).toBe("user");
      expect(allContent).toBe("Just text, no images");
    });

    it("should handle multiple images in message", async () => {
      const { formatMessageWithFiles } = await import(
        "./hooks/useChat.helpers.js"
      );

      const message = "First [Image #1] then text [Image #2] end";
      const attachedFiles: Array<{ path: string; content: string }> = [];
      const imageMap = new Map([
        ["[Image #1]", Buffer.from("fake-image-data-1")],
        ["[Image #2]", Buffer.from("fake-image-data-2")],
      ]);

      const results = await formatMessageWithFiles(
        message,
        attachedFiles,
        80, // terminalWidth
        imageMap,
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check that all expected content is present in the split messages
      const allContent = results.map((r) => r.message.content).join("");
      expect(allContent).toContain("First");
      expect(allContent).toContain("[Image #1]");
      expect(allContent).toContain("then text");
      expect(allContent).toContain("[Image #2]");
      expect(allContent).toContain("end");
    });
  });
});
