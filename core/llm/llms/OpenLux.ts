import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class OpenLux extends OpenAI {
  static providerName = "openlux";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.openlux.ai/v1/",
    model: "claude-sonnet-5-5",
    useLegacyCompletionsEndpoint: false,
  };
}

export default OpenLux;
