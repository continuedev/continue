import { LLMOptions } from "../..";
import { LlmApiRequestType } from "../openaiTypeConverters";

import OpenAI from "./OpenAI";

export class Relace extends OpenAI {
  static providerName = "relace";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://instantapply.endpoint.relace.run/v1/code/apply",
  };
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = ["*"];
}
