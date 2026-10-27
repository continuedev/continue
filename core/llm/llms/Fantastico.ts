import { LLMOptions } from "../../index.js";
import { LlmApiRequestType } from "../openaiTypeConverters.js";

import OpenAI from "./OpenAI.js";

/**
 * Fantastico mints a short-lived runtime key from the user's account key and
 * then calls the model provider directly. The key exchange lives in the
 * openai-adapters FantasticoApi, so every request goes through the adapter.
 */
class Fantastico extends OpenAI {
  static providerName = "fantastico";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://fantastico.cc/api/",
    useLegacyCompletionsEndpoint: false,
  };

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = ["*"];
}

export default Fantastico;
