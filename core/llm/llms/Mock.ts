import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";

class Mock extends BaseLLM {
  public completion: string = "Test Completion";
  static providerName: ModelProvider = "mock";

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
    token?: AbortSignal
  ): AsyncGenerator<string> {
    yield this.completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
    token?: AbortSignal
  ): AsyncGenerator<ChatMessage> {
    for (const char of this.completion) {
      yield {
        role: "assistant",
        content: char,
      };
    }
  }
}

export default Mock;
