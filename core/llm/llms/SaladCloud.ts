import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class SaladCloud extends OpenAI {
  static providerName = "saladcloud";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://ai.salad.cloud/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default SaladCloud;
