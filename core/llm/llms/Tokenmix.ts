import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Tokenmix extends OpenAI {
  static providerName = "tokenmix";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.tokenmix.ai/v1/",
    model: "deepseek/deepseek-v4-pro",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Tokenmix;
