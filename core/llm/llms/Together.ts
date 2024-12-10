import OpenAI from "./OpenAI.js";

import type { CompletionOptions, LLMOptions } from "../../index.js";

class Together extends OpenAI {
  static providerName = "together";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.together.xyz/v1/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "codellama-7b": "togethercomputer/CodeLlama-7b-Instruct",
    "codellama-13b": "togethercomputer/CodeLlama-13b-Instruct",
    "codellama-34b": "togethercomputer/CodeLlama-34b-Instruct",
    "codellama-70b": "codellama/CodeLlama-70b-Instruct-hf",
    "llama3-8b": "meta-llama/Llama-3-8b-chat-hf",
    "llama3-70b": "meta-llama/Llama-3-70b-chat-hf",
    "llama3.1-8b": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "llama3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "llama3.1-405b": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    "llama3.2-3b": "meta-llama/Llama-3.2-3B-Instruct-Turbo",
    "llama3.2-11b": "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    "llama3.2-90b": "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
    "llama2-7b": "togethercomputer/llama-2-7b-chat",
    "llama2-13b": "togethercomputer/llama-2-13b-chat",
    "llama2-70b": "togethercomputer/llama-2-70b-chat",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.1",
    "mistral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "phind-codellama-34b": "Phind/Phind-CodeLlama-34B-v2",
    "wizardcoder-34b": "WizardLM/WizardCoder-Python-34B-V1.0",
  };

  protected _convertModelName(model: string) {
    return Together.MODEL_IDS[model] || this.model;
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

export default Together;
