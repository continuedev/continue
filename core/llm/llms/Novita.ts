import OpenAI from "./OpenAI.js";

import type { CompletionOptions, LLMOptions } from "../../index.js";

class Novita extends OpenAI {
  static providerName = "novita";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.novita.ai/v3/openai/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "deepseek-r1": "deepseek/deepseek-r1",
    "deepseek_v3": "deepseek/deepseek_v3",
    "llama3-8b": "meta-llama/llama-3-8b-instruct",
    "llama3-70b": "meta-llama/llama-3-70b-instruct",
    "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta-llama/llama-3.1-70b-instruct",
    "llama3.1-405b": "meta-llama/llama-3.1-405b-instruct",
    "llama3.2-1b": "meta-llama/llama-3.2-1b-instruct",
    "llama3.2-3b": "meta-llama/llama-3.2-3b-instruct",
    "llama3.2-11b": "meta-llama/llama-3.2-11b-vision-instruct",
    "llama3.3-70b": "meta-llama/llama-3.3-70b-instruct",
    "mistral-nemo": "mistralai/mistral-nemo",
    "mistral-7b": "mistralai/mistral-7b-instruct",
  };

  protected _convertModelName(model: string) {
    return Novita.MODEL_IDS[model] || this.model;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._legacystreamComplete(
      prompt,
      signal,
      options,
    )) {
      yield chunk;
    }
  }
}

export default Novita;
