import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class TrustedRouter extends OpenAI {
  static providerName = "trustedrouter";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.trustedrouter.com/v1/",
    model: "trustedrouter/auto",
    useLegacyCompletionsEndpoint: false,
  };
}

export default TrustedRouter;
