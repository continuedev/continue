import { CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

class LlamaCpp extends BaseLLM {
  static providerName = "llama.cpp";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://127.0.0.1:8080/",
  };

  private _convertArgs(options: CompletionOptions, prompt: string) {
    const finalOptions = {
      n_predict: options.maxTokens,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      min_p: options.minP,
      mirostat: options.mirostat,
      stop: options.stop,
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
    };

    return finalOptions;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(new URL("completions", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        stream: true,
        ...this._convertArgs(options, prompt),
      }),
      signal,
    });

    for await (const value of streamSse(resp)) {
      if (value.content) {
        yield value.content;
      }
    }
  }
}

export default LlamaCpp;
