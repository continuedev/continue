import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Gisoo extends OpenAI {
  static providerName = "gisoo";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://gisoo.pro/api/v1/",
    model: "claude-sonnet-5-5",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Gisoo;
