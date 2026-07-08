import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class TokenLab extends OpenAI {
  static providerName = "tokenlab";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.tokenlab.sh/v1/",
    model: "gpt-5.5",
    useLegacyCompletionsEndpoint: false,
  };

  supportsCompletions(): boolean {
    return false;
  }
}

export default TokenLab;
