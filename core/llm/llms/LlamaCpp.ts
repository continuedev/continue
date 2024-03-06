import { BaseLLM } from "..";
import { CompletionOptions, LLMOptions, ModelProvider } from "../..";
import { streamSse } from "../stream";

class LlamaCpp extends BaseLLM {
  static providerName: ModelProvider = "llama.cpp";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://127.0.0.1:8080",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      n_predict: options.maxTokens,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      min_p: options.minP,
      mirostat: options.mirostat,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(`${this.apiBase}/completion`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
    });

    for await (const value of streamSse(resp)) {
      if (value.content) {
        yield value.content;
      }
    }
  }
}

export default LlamaCpp;
