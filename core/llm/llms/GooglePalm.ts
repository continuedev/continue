import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessagePart,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";
import { streamResponse } from "../stream";

class GooglePalm extends BaseLLM {
  static providerName: ModelProvider = "google-palm";

  static defaultOptions: Partial<LLMOptions> = {
    model: "gemini-pro",
    apiBase: "https://generativelanguage.googleapis.com",
  };

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const message of this._streamChat(
      [{ content: prompt, role: "user" }],
      options,
    )) {
      yield stripImages(message.content);
    }
  }

  private removeSystemMessage(messages: ChatMessage[]) {
    const msgs = [...messages];

    if (msgs[0]?.role === "system") {
      let sysMsg = msgs.shift()!.content;
      // @ts-ignore
      if (msgs[0]?.role === "user") {
        msgs[0].content = `System message - follow these instructions in every response: ${sysMsg}\n\n---\n\n${msgs[0].content}`;
      }
    }

    return msgs;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    let convertedMsgs = this.removeSystemMessage(messages);
    if (options.model.includes("gemini")) {
      for await (const message of this.streamChatGemini(
        convertedMsgs,
        options,
      )) {
        yield message;
      }
    } else {
      for await (const message of this.streamChatBison(
        convertedMsgs,
        options,
      )) {
        yield message;
      }
    }
  }

  private _continuePartToGeminiPart(part: MessagePart) {
    return part.type === "text"
      ? {
          text: part.text,
        }
      : {
          inlineData: {
            mimeType: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
  }

  private async *streamChatGemini(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const apiURL = `${this.apiBase}/v1/models/${options.model}:streamGenerateContent?key=${this.apiKey}`;
    const body = {
      contents: messages.map((msg) => {
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : msg.content.map(this._continuePartToGeminiPart),
        };
      }),
    };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    let buffer = "";
    for await (const chunk of streamResponse(response)) {
      buffer += chunk;
      if (buffer.startsWith("[")) {
        buffer = buffer.slice(1);
      }
      if (buffer.endsWith("]")) {
        buffer = buffer.slice(0, -1);
      }
      if (buffer.startsWith(",")) {
        buffer = buffer.slice(1);
      }

      const parts = buffer.split("\n,");

      let foundIncomplete = false;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let data;
        try {
          data = JSON.parse(part);
        } catch (e) {
          foundIncomplete = true;
          continue;
        }
        if (data.error) {
          throw new Error(data.error.message);
        }

        // Incrementally stream the content to make it smoother
        const content = data.candidates[0].content.parts[0].text;
        const words = content.split(" ");
        const delaySeconds = Math.min(4.0 / (words.length + 1), 0.1);
        while (words.length > 0) {
          const wordsToYield = Math.min(3, words.length);
          yield {
            role: "assistant",
            content: words.splice(0, wordsToYield).join(" ") + " ",
          };
          await delay(delaySeconds);
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
  }
  private async *streamChatBison(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const msgList = [];
    for (const message of messages) {
      msgList.push({ content: message.content });
    }

    const apiURL = `${this.apiBase}/v1beta2/models/${options.model}:generateMessage?key=${this.apiKey}`;
    const body = { prompt: { messages: msgList } };
    const response = await this.fetch(apiURL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    yield { role: "assistant", content: data.candidates[0].content };
  }
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default GooglePalm;
