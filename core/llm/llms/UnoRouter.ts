import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class UnoRouter extends OpenAI {
  static providerName = "unorouter";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.unorouter.com/v1/",
    model: "deepseek-v4-flash:free",
  };
}

export default UnoRouter;
