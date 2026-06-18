import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class AtlasCloud extends OpenAI {
  static providerName = "atlascloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.atlascloud.ai/v1/",
    model: "deepseek-ai/deepseek-v4-pro",
    useLegacyCompletionsEndpoint: false,
  };
}

export default AtlasCloud;
