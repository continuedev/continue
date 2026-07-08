import {
  stripImages,
  renderChatMessage,
  renderContextItems,
  normalizeToMessageParts,
} from "./messageContent.js";
import {
  ChatMessage,
  ContextItem,
  MessageContent,
  MessagePart,
} from "../index.js";

describe("messageContent utility functions", () => {
  describe("stripImages", () => {
    it("should return the string as is if messageContent is a string", () => {
      const content: MessageContent = "This is a test message.";
      expect(stripImages(content)).toBe("This is a test message.");
    });

    it("should strip out image parts and join text parts of a message", () => {
      const content: MessageContent = [
        { type: "text", text: "This is" },
        {
          type: "imageUrl",
          imageUrl: { url: "http://example.com/image1.png" },
        },
        { type: "text", text: "a test message." },
      ];
      expect(stripImages(content)).toBe("This is\na test message.");
    });
  });

  describe("renderChatMessage", () => {
    it("should render user, assistant, or system messages with stripped image content", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: [
          { type: "text", text: "Hello," },
          {
            type: "imageUrl",
            imageUrl: { url: "http://example.com/image.png" },
          },
          { type: "text", text: "world!" },
        ],
      };
      expect(renderChatMessage(message)).toBe("Hello,\nworld!");
    });

    it("should render tool messages as is", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Command output message",
        toolCallId: "1",
      };
      expect(renderChatMessage(message)).toBe("Command output message");
    });
  });

  describe("renderContextItems", () => {
    it("should concatenate the content of context items with two newlines", () => {
      const items: ContextItem[] = [
        {
          content: "Context Item 1",
          name: "Item1",
          description: "Description1",
        },
        {
          content: "Context Item 2",
          name: "Item2",
          description: "Description2",
        },
      ];
      expect(renderContextItems(items)).toBe(
        "Context Item 1\n\nContext Item 2",
      );
    });
  });

  describe("normalizeToMessageParts", () => {
    it("should normalize user, assistant, or system messages to MessagePart array", () => {
      const message: ChatMessage = {
        role: "user",
        content: "This is a test message.",
      };
      const expected: MessagePart[] = [
        { type: "text", text: "This is a test message." },
      ];
      expect(normalizeToMessageParts(message)).toEqual(expected);
    });

    it("should normalize tool messages to MessagePart array", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "Tool message content",
        toolCallId: "1",
      };
      const expected: MessagePart[] = [
        { type: "text", text: "Tool message content" },
      ];
      expect(normalizeToMessageParts(message)).toEqual(expected);
    });
  });
});
