import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class HopBase extends OpenAI {
  static providerName = "hopbase";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.hop-base.com/v1/",
    model: "deepseek-v4.1-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default HopBase;
