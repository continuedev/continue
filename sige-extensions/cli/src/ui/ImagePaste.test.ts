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

      const result = await formatMessageWithFiles(
        message,
        attachedFiles,
        imageMap,
      );

      expect(result.message.role).toBe("user");
      expect(Array.isArray(result.message.content)).toBe(true);

      const content = result.message.content as any[];
      expect(content).toHaveLength(3);
      expect(content[0]).toEqual({
        type: "text",
        text: "Here is an image: ",
      });
      expect(content[1]).toEqual({
        type: "imageUrl",
        imageUrl: { url: expect.stringMatching(/^data:image\/png;base64,/) },
      });
      expect(content[2]).toEqual({
        type: "text",
        text: " and some text",
      });
    });

    it("should handle message with only text (no images)", async () => {
      const { formatMessageWithFiles } = await import(
        "./hooks/useChat.helpers.js"
      );

      const message = "Just text, no images";
      const attachedFiles: Array<{ path: string; content: string }> = [];

      const result = await formatMessageWithFiles(message, attachedFiles);

      expect(result.message.role).toBe("user");
      expect(result.message.content).toBe("Just text, no images");
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

      const result = await formatMessageWithFiles(
        message,
        attachedFiles,
        imageMap,
      );

      expect(Array.isArray(result.message.content)).toBe(true);
      const content = result.message.content as any[];

      // Should have: text, image, text, image, text = 5 parts
      expect(content).toHaveLength(5);
      expect(content[0].type).toBe("text");
      expect(content[1].type).toBe("imageUrl");
      expect(content[2].type).toBe("text");
      expect(content[3].type).toBe("imageUrl");
      expect(content[4].type).toBe("text");
    });
  });
});
