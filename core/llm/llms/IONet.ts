import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class IONet extends OpenAI {
  static providerName = "ionet";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.intelligence.io.solutions/api/v1/",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    useLegacyCompletionsEndpoint: false,
  };
}

export default IONet;
