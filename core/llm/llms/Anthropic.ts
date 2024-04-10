import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
import { stripImages } from "../countTokens";
import { streamSse } from "../stream";

class Anthropic extends BaseLLM {
  static providerName: ModelProvider = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-opus-20240229",
    contextLength: 200_000,
    completionOptions: {
      model: "claude-3-opus-20240229",
      maxTokens: 4096,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  constructor(options: LLMOptions) {
    super(options);
  }

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      model: options.model === "claude-2" ? "claude-2.1" : options.model,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
    };

    return finalOptions;
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = msgs
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (typeof message.content === "string") {
          return message;
        } else {
          return {
            ...message,
            content: message.content.map((part) => {
              if (part.type === "text") {
                return part;
              } else {
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: part.imageUrl?.url.split(",")[1],
                  },
                };
              }
            }),
          };
        }
      });
    return messages;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, options)) {
      yield stripImages(update.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
      },
      body: JSON.stringify({
        ...this._convertArgs(options),
        messages: this._convertMessages(messages),
        system: this.systemMessage,
      }),
    });

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }

    for await (const value of streamSse(response)) {
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }
}

export default Anthropic;
