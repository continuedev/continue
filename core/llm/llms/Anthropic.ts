import { BaseLLM } from "..";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../..";
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
    apiBase: "https://api.anthropic.com/v1",
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
      stop_sequences: options.stop,
    };

    return finalOptions;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const response = await this.fetch(this.apiBase + "/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
      },
      body: JSON.stringify({
        ...this._convertArgs(options),
        messages,
        system: this.systemMessage,
        stream: true,
      }),
    });

    for await (const value of streamSse(response)) {
      if (value.delta?.text) {
        yield { role: "assistant", content: value.delta.text };
      }
    }
  }
}

export default Anthropic;
