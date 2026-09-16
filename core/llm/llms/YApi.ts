import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class YApi extends OpenAI {
  static providerName = "y-api";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.y-api.bestvirtualgoods.com/v1/",
    model: "deepseek/deepseek-v4-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default YApi;
