import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * LiteLLM LLM Provider
 *
 * LiteLLM is an open-source AI gateway that exposes 100+ LLM providers
 * (OpenAI, Anthropic, Azure, Bedrock, Gemini, and more) behind a single
 * OpenAI-compatible API. It is commonly self-hosted as a proxy so teams can
 * centralize API keys, spend limits, fallbacks, and routing.
 *
 * Because the proxy is OpenAI-compatible, this provider extends the OpenAI
 * adapter and defaults to the standard local LiteLLM proxy endpoint. Point
 * `apiBase` at a remote proxy to use a hosted deployment.
 *
 * @see https://docs.litellm.ai/docs/simple_proxy
 */
class LiteLLM extends OpenAI {
  static providerName = "litellm";

  // A LiteLLM proxy can route to reasoning models (DeepSeek, o-series, etc.).
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:4000/v1/",
    model: "gpt-4o-mini",
    useLegacyCompletionsEndpoint: false,
  };
}

export default LiteLLM;
