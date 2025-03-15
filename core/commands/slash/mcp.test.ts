import { substituteLastUserMessage } from "./mcp";
import { ChatMessage, MessagePart, SlashCommand, UserChatMessage } from "../../index.js";

/**
 * Test substitution of the prompt content into the history.
 * actual content collected from debugging actual chats.
 */
describe("substituteLastUserMessage", () => {
  const systemMessage: ChatMessage = {
    role: "system",
    content: "Your are..."
  };

  const assistantEmptyMessage: ChatMessage = {
    role: "assistant",
    content: ""
  };

  const mcpMessage: ChatMessage = {
    role: "user",
    content: [{ type: "text", text: "provide answer" }]
  };
  const mcpHeadMessage: ChatMessage = {
    role: "user",
    content: [{ type: "text", text: "this is important task" }]
  };
  const mcpAssistantMessage: ChatMessage = {
    role: "assistant",
    content: [{ type: "text", text: "I'm assistant" }]
  };

  it("should handle only /echo on first question", () => {
    // Input: `/echo `
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [{ type: "text", text: "/echo " }]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [{ type: "text", text: "provide answer" }, { type: "text", text: "" }]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text on first question", () => {
    // Input: `/echo hello`
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [{ type: "text", text: "/echo hello" }]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [{ type: "text", text: "provide answer" }, { type: "text", text: "hello" }]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text and 1 context on first question", () => {
    // Input: `/echo explain text.ts code`
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "text", text: "/echo explain text.ts code" }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain text.ts code" }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text and 2 contexts on first question", () => {
    // Input: `/echo explain test.ts and test.py`
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "text", text: "text.py code block" },
          { type: "text", text: "/echo explain test.ts and test.py " }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "text", text: "text.py code block" },
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain test.ts and test.py " }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text and image on first question", () => {
    // Input: `/echo explain`
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "/echo explain" }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain" }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text, image, and context on first question", () => {
    // Input: `/echo explain test.ts`
    const history: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "/echo explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle only /echo on second question", () => {
    // Input: `/echo `
    const history: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "first history" },
      { role: "assistant", content: "answer" },
      {
        role: "user",
        content: [{ type: "text", text: "/echo " }]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "first history" },
      { role: "assistant", content: "answer" },
      {
        role: "user",
        content: [{ type: "text", text: "provide answer" }, { type: "text", text: "" }]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text and resource on second question", () => {
    // Same as first question but with more history at the start
    const history: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer" },
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "/echo explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer" },
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."}},
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpMessage]);
    expect(result).toEqual(expected);
  });

  it("should handle /echo with text and resource with multisection prompt", () => {
    // Same as first question but with more history at the start
    const history: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer" },
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."} },
          { type: "text", text: "/echo explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const expected: ChatMessage[] = [
      systemMessage,
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer" },
      mcpHeadMessage,
      mcpAssistantMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "text.ts code block" },
          { type: "imageUrl", imageUrl:{ url: "data:..."}},
          { type: "text", text: "provide answer" },
          { type: "text", text: "explain test.ts" }
        ]
      },
      assistantEmptyMessage
    ];

    const result = substituteLastUserMessage(history, "/echo ", [mcpHeadMessage,mcpAssistantMessage,mcpMessage]);
    expect(result).toEqual(expected);
  });
});