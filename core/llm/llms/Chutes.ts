import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Chutes extends OpenAI {
  static providerName = "chutes";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://llm.chutes.ai/v1/",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Chutes;
