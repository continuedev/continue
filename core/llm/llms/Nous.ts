import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Nous extends OpenAI {
  static providerName = "nous";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://inference-api.nousresearch.com/v1",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Nous;
