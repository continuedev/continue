import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Spark extends OpenAI {
  static providerName = "spark";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://spark-api-open.xf-yun.com/v1/",
    model: "4.0Ultra",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Spark;
