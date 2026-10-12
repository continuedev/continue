import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Mixlayer extends OpenAI {
  static providerName = "mixlayer";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://mixlayer.ai/v1/",
    model: "z-ai/glm-5.3",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Mixlayer;
