import OpenAI from "./OpenAI";

import { LLMOptions } from "../../index.js";


class Scaleway extends OpenAI {
  static providerName = "scaleway";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.scaleway.ai/v1/",
    model: "qwen2.5-coder-32b-instruct",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.1-8b": "llama-3.1-8b-instruct",
    "llama3.1-70b": "llama-3.1-70b-instruct",
    "mistral-nemo": "mistral-nemo-instruct-2407",
    "qwen2.5-coder-32b": "qwen2.5-coder-32b-instruct",
    "pixtral": "pixtral-12b-2409",
  };

  protected _convertModelName(model: string) {
    return Scaleway.MODEL_IDS[model] || this.model;
  }
}

export default Scaleway;
