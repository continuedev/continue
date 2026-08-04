import type { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class SaladCloud extends OpenAI {
  static providerName = "saladcloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://ai.salad.cloud/v1/",
    model: "qwen3.6-35b-a3b",
    useLegacyCompletionsEndpoint: false,
  };
}

export default SaladCloud;
