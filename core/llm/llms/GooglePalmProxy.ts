import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { ideRequest } from "../../ide/messaging";
import { ChatMessage, CompletionOptions } from "../types";

class GooglePalmProxy extends LLM {
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
    const response = await ideRequest("googlePalmCompletion", {
      modelTitle: this.title,
      options,
      messages,
    });
    yield { role: "user", content: response };
  }
}

export default GooglePalmProxy;
