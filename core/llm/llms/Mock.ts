import { ChatMessage, CompletionOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

class MockLLM extends BaseLLM {
  public completion: string = "Test Completion";
  static providerName = "mock";

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    yield this.completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    for (const char of this.completion) {
      yield {
        role: "assistant",
        content: char,
      };
    }
  }
}

export default MockLLM;
