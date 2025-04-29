import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class SambaNova extends OpenAI {
  static providerName = "sambanova";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.sambanova.ai/v1/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "llama4-scout": "Llama-4-Scout-17B-16E-Instruct",
    "llama4-maverick": "Llama-4-Maverick-17B-128E-Instruct",
    "llama3.3-70b": "Meta-Llama-3.3-70B-Instruct",
    "llama3.1-8b": "Meta-Llama-3.1-8B-Instruct",
    "llama3.1-405b": "Meta-Llama-3.1-405B-Instruct",
    "llama3.2-1b": "Meta-Llama-3.2-1B-Instruct",
    "llama3.2-3b": "Meta-Llama-3.2-3B-Instruct",
    "qwq-32b": "QwQ-32B",
    "deepseek-r1-distill-llama-70b": "DeepSeek-R1-Distill-Llama-70B",
    "deepseek-r1": "DeepSeek-R1",
    "deepseek-v3": "DeepSeek-V3-0324",
  };

  protected _convertModelName(model: string) {
    return SambaNova.MODEL_IDS[model] || this.model;
  }
}

export default SambaNova;
