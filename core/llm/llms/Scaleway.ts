import OpenAI from "./OpenAI";

import { LLMOptions, CompletionOptions, ChatMessage } from "../../index.js";
import { ChatCompletionCreateParams } from "openai/resources/index";

class Scaleway extends OpenAI {
  static providerName = "scaleway";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.scaleway.ai/v1/",
    model: "qwen2.5-coder-32b-instruct",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.1-8b": "llama-3.1-8b-instruct",
    "llama3.3-70b": "llama-3.3-70b-instruct",
    "mistral-small3.1": "mistral-small-3.1-24b-instruct-2503",
    "deepseek-r1-distill-llama-70b": "deepseek-r1-distill-llama-70b",
    "qwen2.5-coder-32b": "qwen2.5-coder-32b-instruct",
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
