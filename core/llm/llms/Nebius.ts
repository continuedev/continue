import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Nebius extends OpenAI {
  static providerName = "nebius";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.studio.nebius.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  private static MODEL_IDS: { [name: string]: string } = {
    "deepseek/deepseek_v3": "deepseek-ai/DeepSeek-V3",
    "deepseek/deepseek-r1": "deepseek-ai/DeepSeek-R1",
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct-fast",
    "Qwen/QwQ-32B-Preview": "Qwen/QwQ-32B-Preview",
    "llama3.1-70b-nemotron": "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF-fast",
    "llama3.1-8b": "meta-llama/Meta-Llama-3.1-70B-Instruct-fast",
    "llama3.1-70b": "meta-llama/Meta-Llama-3.1-70B-Instruct-fast",
    "llama3.1-405b": "meta-llama/Meta-Llama-3.1-405B-Instruct",
    "mistral-nemo": "mistralai/Mistral-Nemo-Instruct-2407-fast",
    "mistral-8x7b": "mistralai/Mixtral-8x7B-Instruct-v0.1-fast",
    "mistral-8x22b": "mistralai/Mixtral-8x22B-Instruct-v0.1-fast",
    "qwen-coder2.5-7b": "Qwen/Qwen2.5-Coder-7B-Instruct-fast",
    "deepseek-2-lite": "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-fast",
    "phi-3-mini": "microsoft/Phi-3-mini-4k-instruct-fast",
    "phi-3-medium": "microsoft/Phi-3-medium-128k-instruct-fast",
    "gemma2-2b-it": "google/gemma-2-2b-it-fast",
    "gemma2-9b-it": "google/gemma-2-9b-it-fast",
    "olmo-7b": "allenai/OLMo-7B-Instruct-hf",
  };

  protected _convertModelName(model: string) {
    return Nebius.MODEL_IDS[model] || this.model;
  }
}

export default Nebius;
