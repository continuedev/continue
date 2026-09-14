import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class ApiRoute extends OpenAI {
  static providerName = "api-route";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://global.api-route.com/v1/",
    model: "claude-3-7-sonnet-20250219",
    useLegacyCompletionsEndpoint: false,
  };
}

export default ApiRoute;
