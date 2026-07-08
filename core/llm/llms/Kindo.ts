import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Kindo extends OpenAI {
  static providerName = "kindo";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://llm.kindo.ai/v1/",
    requestOptions: {
      headers: {
        "kindo-token-transaction-type": "CONTINUE",
      },
    },
  };
}

export default Kindo;
