import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class SambaNova extends OpenAI {
  static providerName = "sambanova";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.sambanova.ai/v1/",
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "qwen2.5-coder-32b": "Qwen2.5-Coder-32B-Instruct",
    "llama3.3-70b": "Meta-Llama-3.3-70B-Instruct",
    "llama3.1-8b": "Meta-Llama-3.1-8B-Instruct",
    "llama3.1-70b": "Meta-Llama-3.1-70B-Instruct",
    "llama3.1-405b": "Meta-Llama-3.1-405B-Instruct",
    "llama3.1-tulu-405b": "Llama-3.1-Tulu-3-405B",
    "llama3.2-1b": "Meta-Llama-3.2-1B-Instruct",
    "llama3.2-3b": "Meta-Llama-3.2-3B-Instruct",
    "llama3.2-11b": "Llama-3.2-11B-Vision-Instruct",
    "llama3.2-90b": "Llama-3.2-90B-Vision-Instruct",
    "qwen2.5-72b": "Qwen2.5-72B-Instruct",
    "qwq-32b": "QwQ-32B-Preview",
    "deepseek-r1-distill-llama-70b": "DeepSeek-R1-Distill-Llama-70B",
    "deepseek-r1": "DeepSeek-R1",
  };

  protected _convertModelName(model: string) {
    return SambaNova.MODEL_IDS[model] || this.model;
  }
}

export default SambaNova;
