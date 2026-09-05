import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class AIgateway extends OpenAI {
  static providerName = "aigateway";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.aigateway.sh/v1",
    model: "zai-org/glm-5.3-flash",
  };
}

export default AIgateway;
