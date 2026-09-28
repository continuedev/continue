import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class DemonRoute extends OpenAI {
  static providerName = "demonroute";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.demonroute.com/v1/",
    model: "NousResearch/Hermes-4-70B",
    useLegacyCompletionsEndpoint: false,
  };

  // DemonRoute only serves the Chat Completions API
  supportsCompletions(): boolean {
    return false;
  }
}

export default DemonRoute;
