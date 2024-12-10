import { ChatMessage, CompletionOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

const HARDCODED_CHAT_RESPONSE = "THIS IS A HARDCODED RESPONSE";

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
    yield this.findResponse(prompt) || `PROMPT: ${prompt}`;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    for (const char of HARDCODED_CHAT_RESPONSE) {
      yield {
        role: "assistant",
        content: char,
      };
    }
  }
}

export default TestLLM;
