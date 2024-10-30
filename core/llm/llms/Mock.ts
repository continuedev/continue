import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";

class Mock extends BaseLLM {
  completion = "Test Completion";
  static providerName: ModelProvider = "mock";

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    yield this.completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    yield {
      role: "assistant",
      content: this.completion,
    };
  }
}

export default Mock;
