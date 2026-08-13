import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Nebius extends OpenAI {
  static providerName = "nebius";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.tokenfactory.nebius.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Nebius;
