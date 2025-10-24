import { ChatMessage, CompletionOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

const HARDCODED_CHAT_RESPONSE = "THIS IS A HARDCODED RESPONSE";
const NEXT_EDIT_COMPLETION: string = "<|editable_region_start|>\nHELLO\n";

class TestLLM extends BaseLLM {
  static providerName = "test";

  private findResponse(prompt: string) {
    // Matches TEST_USER_MESSAGE_ followed by digits, preceded and followed by non-digit characters
    const matches = Array.from(
      prompt.matchAll(/[^0-9]*TEST_USER_MESSAGE_(\d+)[^0-9]*/g),
    );
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const number = lastMatch[1];
      return `TEST_LLM_RESPONSE_${number}`;
    }
    return undefined;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    if (
      prompt === "NEXT_EDIT" ||
      prompt ===
        "<|im_start|>user\nNEXT_EDIT<|im_end|>\n<|im_start|>assistant\n"
    ) {
      yield NEXT_EDIT_COMPLETION;
    } else {
      yield this.findResponse(prompt) || `PROMPT: ${prompt}`;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    // Look for test messages in the chat history
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    let testResponse: string | undefined;

    if (lastUserMessage) {
      const content =
        typeof lastUserMessage.content === "string"
          ? lastUserMessage.content
          : lastUserMessage.content
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("");
      testResponse = this.findResponse(content);
    }

    const responseText = testResponse || HARDCODED_CHAT_RESPONSE;

    // Stream character by character with realistic network-like delays
    // This simulates real provider behavior and prevents overwhelming the event loop
    for (const char of responseText) {
      yield {
        role: "assistant",
        content: char,
      };
      // Add realistic delay to simulate network latency (10-30ms per chunk)
      await new Promise((resolve) =>
        setTimeout(resolve, 10 + Math.random() * 20),
      );
    }
  }
}

export default TestLLM;
