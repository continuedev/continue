import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Avian extends OpenAI {
  static providerName = "avian";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.avian.io/v1",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Avian;
