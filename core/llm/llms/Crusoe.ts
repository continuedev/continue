import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Crusoe extends OpenAI {
  static providerName = "crusoe";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.inference.crusoecloud.com/v1",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Crusoe;
