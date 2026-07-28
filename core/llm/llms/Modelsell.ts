import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Modelsell extends OpenAI {
  static providerName = "modelsell";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://modelsell.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Modelsell;
