import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * CrowLLM LLM Provider
 *
 * OpenAI-compatible gateway: one endpoint and one key for every model,
 * with a zero-rated `:free` shelf next to the paid ids.
 *
 * @see https://crowllm.com/docs
 */
class CrowLLM extends OpenAI {
  static providerName = "crowllm";

  // The gateway relays reasoning models, so reasoning fields stay on the wire
  protected supportsReasoningField = true;

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://crowllm.com/v1/",
    model: "deepseek-v4-flash",
    useLegacyCompletionsEndpoint: false,
  };
}

export default CrowLLM;
