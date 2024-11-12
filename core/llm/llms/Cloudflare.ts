import { ChatMessage, CompletionOptions, ModelProvider } from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
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
    const url = this.aiGatewaySlug
      ? `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.aiGatewaySlug}/workers-ai/v1/chat/completions`
      : `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`;
    const resp = await this.fetch(new URL(url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        stream: true,
        model: this.model,
        ...this._convertArgs(options),
      }),
    });

    for await (const value of streamSse(resp)) {
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
