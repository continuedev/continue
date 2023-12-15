import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { ideStreamRequest } from "../../ide/messaging";

class GooglePalmProxy extends BaseLLM {
  static providerName: ModelProvider = "google-palm";
  static defaultOptions: Partial<LLMOptions> = {
    model: "chat-bison-001",
  };

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      options
    )) {
      yield message.content;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    for await (const content of ideStreamRequest("googlePalmCompletion", {
      modelTitle: this.title,
      options,
      messages,
    })) {
      yield { role: "user", content };
    }
  }
}

export default GooglePalmProxy;
