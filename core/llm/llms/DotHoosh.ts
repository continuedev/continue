import { LLMOptions } from "../..";

import OpenAI from "./OpenAI";

class DotHoosh extends OpenAI {
  static providerName = "dothoosh";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://gateway.dothoosh.com/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default DotHoosh;
