import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class FuturMix extends OpenAI {
  static providerName = "futurmix";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://futurmix.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default FuturMix;
