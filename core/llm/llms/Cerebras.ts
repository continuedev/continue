import { ChatMessage, CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class Cerebras extends BaseLLM {
  static providerName: ModelProvider = "cerebras";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cerebras.ai/v1",
  };

  private _convertArgs(options: CompletionOptions) {
    return {
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(new URL("chat/completions", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: true,
        ...this._convertArgs(options),
      }),
    });

    for await (const chunk of streamSse(resp)) {
      if (chunk.choices?.[0]?.delta?.content) {
        yield {
          role: "assistant",
          content: chunk.choices[0].delta.content,
        };
      }
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const stream = await this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    );

    for await (const chunk of stream) {
      if (typeof chunk.content === 'string') {
      yield chunk.content;
      } else if (Array.isArray(chunk.content)) {
        yield chunk.content.map(part => part.text).join('');
    }
  }
}
}

export default Cerebras;
