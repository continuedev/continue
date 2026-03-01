import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class ModelsLab extends OpenAI {
  static providerName = "modelslab";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://modelslab.com/api/uncensored-chat/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default ModelsLab;
