import OpenAI from "./OpenAI.js";

import type { CompletionOptions, LLMOptions } from "../../index.js";

class PPIO extends OpenAI {
  static providerName = "ppio";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.ppinfra.com/v3/openai/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "deepseek-v3-community": "deepseek/deepseek-v3/community",
    "deepseek-r1-community": "deepseek/deepseek-r1/community",
    "deepseek-r1": "deepseek/deepseek-r1",
    "deepseek-v3": "deepseek/deepseek-v3",
    "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
    "llama3.1-70b": "meta-llama/llama-3.1-70b-instruct",
    "llama3.2-3b": "meta-llama/llama-3.2-3b-instruct",
    "qwen-2.5-72b": "qwen/qwen-2.5-72b-instruct",
    "qwen-2-vl-72b": "qwen/qwen-2-vl-72b-instruct",
  };

  protected _convertModelName(model: string) {
    return PPIO.MODEL_IDS[model] || this.model;
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

export default PPIO;
