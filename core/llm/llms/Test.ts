import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";

const RESPONSES: Record<string, string> = {
  "How are you?": "I'm fine",
};

const HARDCODED_CHAT_RESPONSE = "THIS IS A HARDCODED RESPONSE";

class TestLLM extends BaseLLM {
  static providerName: ModelProvider = "test";

  private findResponse(prompt: string) {
    return Object.entries(RESPONSES).find(([key]) => prompt.includes(key))?.[1];
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
