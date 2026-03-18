import { CompletionOptions } from "../../..";

import OpenAI from "./OpenAI";

import type { ChatMessage } from "../chatTransformers.js";
import type { LLMOptions } from "../../index.js";

class ModelsLab extends OpenAI {
  static providerName = "modelslab";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://modelslab.com/api/uncensored-chat/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.1-8b": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "llama3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct",
    "llama3.1-405b": "meta-llama/Meta-Llama-3.1-405B-Instruct",
    "llama3-8b": "meta-llama/Meta-Llama-3-8B-Instruct",
    "llama3-70b": "meta-llama/Meta-Llama-3-70B-Instruct",
    "llama2-70b": "meta-llama/Llama-2-70b-chat-hf",
    "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.2",
    "mixtral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "mixtral-8x22b": "mistralai/Mixtral-8x22B-Instruct-v0.1",
    "qwen-2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
    "qwen-2.5-14b": "Qwen/Qwen2.5-14B-Instruct",
    "qwen-2.5-32b": "Qwen/Qwen2.5-32B-Instruct",
    "qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
    "phi-3-mini-4k": "microsoft/Phi-3-mini-4k-instruct",
    "phi-3-medium-4k": "microsoft/Phi-3-medium-4k-instruct",
    "gemma-2-9b": "google/gemma-2-9b-it",
    "gemma-2-27b": "google/gemma-2-27b-it",
    "falcon-180b": "tiiuae/falcon-180B-chat",
    "yi-34b": "01-ai/Yi-34B-Chat",
  };

  protected _convertModelName(model: string): string {
    return ModelsLab.MODEL_IDS[model] || model;
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): any {
    // Apply model name conversion before creating the request body
    const convertedOptions = {
      ...options,
      model: this._convertModelName(options.model),
    };
    return super._convertArgs(convertedOptions, messages);
  }
}

export default ModelsLab;
