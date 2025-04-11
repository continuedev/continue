import { ChatMessage } from "..";
import { flattenMessages } from "./countTokens";

describe("flattenMessages", () => {
  it("should return an empty array when given an empty array", () => {
    expect(flattenMessages([])).toEqual([]);
  });

  it("should return the same array when there is only one message", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    expect(flattenMessages(messages)).toEqual(messages);
  });

  it("should return the same array when messages have different roles", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ];
    expect(flattenMessages(messages)).toEqual(messages);
  });

  it("should combine consecutive messages with the same role", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: "How are you?" },
      { role: "assistant", content: "I am an AI assistant." },
      { role: "assistant", content: "How can I help you?" },
    ];
    const expected: ChatMessage[] = [
      { role: "user", content: "Hello\n\nHow are you?" },
      {
        role: "assistant",
        content: "I am an AI assistant.\n\nHow can I help you?",
      },
    ];
    expect(flattenMessages(messages)).toEqual(expected);
  });

  it("should handle messages with undefined or empty content", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: "" },
      { role: "assistant", content: "" },
      { role: "assistant", content: "Sure, I can help with that." },
    ];
    const expected: ChatMessage[] = [
      { role: "user", content: "Hello\n\n" },
      { role: "assistant", content: "\n\nSure, I can help with that." },
    ];
    expect(flattenMessages(messages)).toEqual(expected);
  });

  it("should not combine non-consecutive messages with the same role", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "Reply to first message" },
      { role: "user", content: "Second message" },
    ];
    expect(flattenMessages(messages)).toEqual(messages);
  });

  it("should handle a mix of message roles and contents correctly", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Message one" },
      { role: "user", content: "Message two" },
      { role: "assistant", content: "Reply one" },
      { role: "user", content: "Message three" },
      { role: "user", content: "Message four" },
      { role: "assistant", content: "Reply two" },
    ];
    const expected: ChatMessage[] = [
      { role: "user", content: "Message one\n\nMessage two" },
      { role: "assistant", content: "Reply one" },
      { role: "user", content: "Message three\n\nMessage four" },
      { role: "assistant", content: "Reply two" },
    ];
    expect(flattenMessages(messages)).toEqual(expected);
  });

  it("should not combine adjacent assistant messages when one of them is a tool call", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "What's the capital of France?" },
      { role: "assistant", content: "Paris" },
      {
        role: "assistant",
        content: " ",
        toolCalls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "getCapital",
              arguments: JSON.stringify({
                country: "France",
              }),
            },
          },
        ],
      },
    ];
    expect(flattenMessages(messages).length).toBe(3);
  });
});
