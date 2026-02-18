import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class xAI extends OpenAI {
  static providerName = "xAI";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.x.ai/v1/",
  };
}

export default xAI;
