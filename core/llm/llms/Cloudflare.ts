import { BaseLLM } from "../index.js";
import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { stripImages } from "../countTokens.js";
import { streamSse } from "../stream.js";

export default class Cloudflare extends BaseLLM {
  static providerName: ModelProvider = "cloudflare";

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      max_tokens: options.maxTokens,
    };

    return finalOptions;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage, any, unknown> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(
      new URL(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`,
      ),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages,
          stream: true,
          model: this.model,
          ...this._convertArgs(options),
        }),
      },
    );

    for await (const value of streamSse(resp)) {
      console.log(value);
      if (value.choices?.[0]?.delta?.content) {
        yield value.choices[0].delta;
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      yield stripImages(chunk.content);
    }
  }
}
