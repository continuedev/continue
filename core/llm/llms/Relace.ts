import { LLMOptions } from "../..";
import { LLMConfigurationStatus } from "../constants";
import { LlmApiRequestType } from "../openaiTypeConverters";

import OpenAI from "./OpenAI";

export class Relace extends OpenAI {
  static providerName = "relace";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://instantapply.endpoint.relace.run/v1/",
  };
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = ["*"];

  getConfigurationStatus() {
    if (!this.apiKey) {
      return LLMConfigurationStatus.MISSING_API_KEY;
    }

    return LLMConfigurationStatus.VALID;
  }
}
