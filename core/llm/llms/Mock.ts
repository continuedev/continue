import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";

class Mock extends BaseLLM {
  static Completion = "Test Completion";
  static providerName: ModelProvider = "mock";

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    yield Mock.Completion;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    yield {
      role: "assistant",
      content: Mock.Completion,
    };
  }
}

export default Mock;
