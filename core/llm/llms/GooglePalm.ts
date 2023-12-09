import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";

class GooglePalm extends LLM {
  static providerName: ModelProvider = "google-palm";

  static defaultOptions: Partial<LLMOptions> = {
    model: "chat-bison-001",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {};

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const apiURL = `https://generativelanguage.googleapis.com/v1beta2/models/${options.model}:generateMessage?key=${this.apiKey}`;
    const body = { prompt: { messages: [{ content: prompt }] } };
    const response = await fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data.candidates[0].content;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const msgList = [];
    for (const message of messages) {
      msgList.push({ content: message.content });
    }

    const apiURL = `https://generativelanguage.googleapis.com/v1beta2/models/${options.model}:generateMessage?key=${this.apiKey}`;
    const body = { prompt: { messages: msgList } };
    const response = await fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { role: "assistant", content: data.candidates[0].content };
  }
}

export default GooglePalm;
