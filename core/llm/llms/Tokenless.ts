import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Tokenless extends OpenAI {
  static providerName = "tokenless";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.tokenless.store/api/v1/",
    model: "fable-5.2",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Tokenless;
