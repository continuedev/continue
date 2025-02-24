import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { ChatCompletionCreateParams } from "openai/resources/index";

import OpenAI from "./OpenAI.js";

class NCompass extends OpenAI {
  static providerName = "ncompass";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.ncompass.tech/v1",
  };

  private static modelConversion: { [key: string]: string } = {
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "qwen2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
    "llama3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
    "llama3.1-8b": "meta-llama/Llama-3.1-8B-Instruct",
  };
  protected _convertModelName(model: string): string {
    return NCompass.modelConversion[model] ?? model;
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const finalOptions = super._convertArgs(options, messages);
    finalOptions.model = this._convertModelName(options.model);
    return finalOptions;
  }

  protected _getHeaders() {
    const headers = super._getHeaders() as { "Content-Type": string; Authorization: string; "api-key": string; Accept?: string };
    headers["Accept"] = "text/event-stream";
    return headers;
  }

}

export default NCompass;
