import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Pinstripes extends OpenAI {
  static providerName = "pinstripes";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://pinstripes.io/v1/",
    model: "ps/deepseek-v4-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Pinstripes;
