import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Kindo extends OpenAI {
  static providerName = "kindo";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://llm-router.kindo.ai/",
    requestOptions: {
      headers: {
        "kindo-token-transaction-type": "CONTINUE",
      },
    },
  };
}

export default Kindo;