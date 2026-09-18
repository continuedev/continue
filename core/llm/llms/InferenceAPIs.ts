import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class InferenceAPIs extends OpenAI {
  static providerName = "inferenceapis";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.inferenceapis.com/v1/",
    model: "zai-org/GLM-5.3",
    useLegacyCompletionsEndpoint: false,
  };
}

export default InferenceAPIs;
