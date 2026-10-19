import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Synap extends OpenAI {
  static providerName = "synap";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://pool.linkrra.com/v1/",
    model: "synap-v1",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Synap;
