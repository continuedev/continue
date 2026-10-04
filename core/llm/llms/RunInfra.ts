import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class RunInfra extends OpenAI {
  static providerName = "runinfra";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.runinfra.ai/v1/",
    model: "deepseek-v4-1-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default RunInfra;
