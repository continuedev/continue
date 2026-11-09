import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Kitani extends OpenAI {
  static providerName = "kitani";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.kitani.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Kitani;
