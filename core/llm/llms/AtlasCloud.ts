import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class AtlasCloud extends OpenAI {
  static providerName = "atlascloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.atlascloud.ai/v1/",
    model: "openai/gpt-4.1-mini",
    useLegacyCompletionsEndpoint: false,
  };
}

export default AtlasCloud;
