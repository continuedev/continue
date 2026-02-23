import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class Brainiall extends OpenAI {
  static providerName = "brainiall";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://apim-ai-apis.azure-api.net/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Brainiall;
