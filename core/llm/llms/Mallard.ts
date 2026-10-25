import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Mallard extends OpenAI {
  static providerName = "mallard";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.mallardai.co.uk/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Mallard;
