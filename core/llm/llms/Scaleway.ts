import OpenAI from "./OpenAI";

import { LLMOptions, CompletionOptions, ChatMessage } from "../../index.js";
import { ChatCompletionCreateParams } from "openai/resources/index";

class Scaleway extends OpenAI {
  static providerName = "scaleway";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.scaleway.ai/v1/",
    model: "qwen3.6-35b-a3b",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.3-70b": "llama-3.3-70b-instruct",
    "pixtral-12b": "pixtral-12b-2409",
    "mistral-small3.2": "mistral-small-3.2-24b-instruct-2506",
    "mistral-medium3.5": "mistral-medium-3.5-128b",
    "devstral-2": "devstral-2-123b-instruct-2512",
    "qwen3-coder-30b-a3b": "qwen3-coder-30b-a3b-instruct",
    "qwen3-235b-a22b": "qwen3-235b-a22b-instruct-2507",
    "qwen3.5-397b-a17b": "qwen3.5-397b-a17b",
    "qwen3.6-35b-a3b": "qwen3.6-35b-a3b",
    "gemma-3-27b": "gemma-3-27b-it",
    "gemma-4-26b-a4b": "gemma-4-26b-a4b-it",
    "bge-multilingual-gemma2": "bge-multilingual-gemma2",
    "qwen3-embedding-8b": "qwen3-embedding-8b",
    "gpt-oss-120b": "gpt-oss-120b",
  };

  protected _convertModelName(model: string) {
    return Scaleway.MODEL_IDS[model] || this.model;
  }
  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    // Convert model name in the options before passing to parent
    const modifiedOptions = {
      ...options,
      model: this._convertModelName(options.model),
    };
    return super._convertArgs(modifiedOptions, messages);
  }
}

export default Scaleway;
