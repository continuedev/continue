import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * ClawRouter LLM Provider
 *
 * ClawRouter is an open-source LLM router that automatically selects the
 * cheapest capable model for each request based on prompt complexity.
 * It provides an OpenAI-compatible API at localhost:1337.
 *
 * @see https://github.com/BlockRunAI/ClawRouter
 */
class ClawRouter extends OpenAI {
  static providerName = "clawrouter";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:1337/v1/",
    model: "blockrun/auto",
    useLegacyCompletionsEndpoint: false,
  };
}

export default ClawRouter;
