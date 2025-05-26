import { ChatCompletionCreateParams } from "openai/resources/index";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

export class OVHcloud extends OpenAI {
  static providerName = "ovhcloud";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/",
    model: "Qwen2.5-Coder-32B-Instruct",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.1-8b": "Llama-3.1-8B-Instruct",
    "llama3.1-70b": "Meta-Llama-3_1-70B-Instruct",
    "llama3.3-70b": "Meta-Llama-3_3-70B-Instruct",
    "qwen2.5-coder-32b": "Qwen2.5-Coder-32B-Instruct",
    "codestral-mamba-latest": "mamba-codestral-7B-v0.1",
    "mistral-7b": "Mistral-7B-Instruct-v0.3",
    "mistral-8x7b": "Mixtral-8x7B-Instruct-v0.1",
    "mistral-nemo": "Mistral-Nemo-Instruct-2407",
    "DeepSeek-R1-Distill-Llama-70B": "DeepSeek-R1-Distill-Llama-70B",
  };

  protected _convertModelName(model: string) {
    return OVHcloud.MODEL_IDS[model] || this.model;
  }

  protected _convertArgs(
    options: CompletionOptions,
    messages: ChatMessage[],
  ): ChatCompletionCreateParams {
    const modifiedOptions = {
      ...options,
      model: this._convertModelName(options.model),
    };
    return super._convertArgs(modifiedOptions, messages);
  }
}

export default OVHcloud;
