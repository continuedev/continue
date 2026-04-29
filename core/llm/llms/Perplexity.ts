import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * Perplexity provider
 *
 * Integrates with Perplexity's OpenAI-compatible chat completions API.
 * Provides access to Sonar models, which include built-in web search —
 * useful for coding agents that need to research up-to-date documentation
 * or APIs while answering.
 *
 * More information at: https://docs.perplexity.ai/docs/getting-started
 */
class Perplexity extends OpenAI {
  static providerName = "perplexity";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.perplexity.ai/",
    model: "sonar",
  };
}

export default Perplexity;
