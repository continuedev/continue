import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";

class GooglePalm extends BaseLLM {
  static providerName: ModelProvider = "google-palm-real";

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
    if (options.model.includes("gemini")) {
      for await (const message of this.streamChatGemini(messages, options)) {
        yield message;
      }
    } else {
      for await (const message of this.streamChatBison(messages, options)) {
        yield message;
      }
    }
  }

  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: messages.map((msg) => {
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        };
      }),
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    } else if (data.candidates[0].finishReason === "OTHER") {
      throw new Error("Google PaLM API returned empty response");
    }
    yield {
      role: "assistant",
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    };
  }
  private async *streamChatBison(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const msgList = [];
    for (const message of messages) {
      msgList.push({ content: message.content });
    }

    const apiURL = `https://generativelanguage.googleapis.com/v1beta2/models/${options.model}:generateMessage?key=${this.apiKey}`;
    const body = { prompt: { messages: msgList } };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    yield { role: "assistant", content: data.candidates[0].content };
  }
}

export default GooglePalm;
