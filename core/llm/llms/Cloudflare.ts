import { streamSse } from "@continuedev/fetch";
import { ChatMessage, CompletionOptions } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

export default class Cloudflare extends BaseLLM {
  static providerName = "cloudflare";

  private _convertArgs(options: CompletionOptions) {
    const finalOptions = {
      max_tokens: options.maxTokens,
    };

    return finalOptions;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
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
      signal,
    });

    for await (const value of streamSse(resp)) {
      if (value.choices?.[0]?.delta?.content) {
        yield {
          role: "assistant",
          content: value.choices[0].delta.content,
        };
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      yield renderChatMessage(chunk);
    }
  }
}
