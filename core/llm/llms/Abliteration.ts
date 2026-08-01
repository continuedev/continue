import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Abliteration extends OpenAI {
  static providerName = "abliteration";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.abliteration.ai/v1/",
    model: "abliterated-model",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Abliteration;
