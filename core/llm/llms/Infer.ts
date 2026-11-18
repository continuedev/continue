import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Infer extends OpenAI {
  static providerName = "infer";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://infer.flow7.org/v1/",
    model: "infer/claude-opus-5-5:low-cost",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Infer;
