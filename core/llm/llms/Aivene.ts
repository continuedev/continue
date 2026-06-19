import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Aivene extends OpenAI {
  static providerName = "aivene";
  protected supportsReasoningContentField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.aivene.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Aivene;
