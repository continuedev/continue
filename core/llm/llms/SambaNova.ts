import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class SambaNova extends OpenAI {
  static providerName = "sambanova";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.sambanova.ai/v1/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama3.1-8b": "Meta-Llama-3.1-8B-Instruct",
    "llama3.1-70b": "Meta-Llama-3.1-70B-Instruct",
    "llama3.1-405b": "Meta-Llama-3.1-405B-Instruct",
    "llama3.1-1b": "Meta-Llama-3.2-1B-Instruct",
    "llama3.1-3b": "Meta-Llama-3.2-3B-Instruct",
  };

  protected _convertModelName(model: string) {
    return SambaNova.MODEL_IDS[model] || this.model;
  }
}

export default SambaNova;
