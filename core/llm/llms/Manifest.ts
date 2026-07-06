import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * Manifest LLM Provider
 *
 * Manifest is an open-source, OpenAI-compatible gateway for AI agents. It
 * exposes a single endpoint in front of multiple providers (API keys,
 * subscriptions, local models), with per-message cost/token tracking and
 * automatic fallback when a provider fails.
 *
 * The served model is resolved server-side from the user's dashboard
 * configuration, so requests always target the single `auto` model id.
 *
 * @see https://github.com/mnfst/manifest
 */
class Manifest extends OpenAI {
  static providerName = "manifest";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://app.manifest.build/v1/",
    model: "auto",
    useLegacyCompletionsEndpoint: false,
  };
}

export default Manifest;
