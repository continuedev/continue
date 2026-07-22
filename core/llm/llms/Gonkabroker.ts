import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Gonkabroker extends OpenAI {
  static providerName = "gonkabroker";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://proxy.gonkabroker.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Gonkabroker;
