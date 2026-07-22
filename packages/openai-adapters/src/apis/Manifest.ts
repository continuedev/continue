import { OpenAIApi } from "./OpenAI.js";
import { OpenAIConfig } from "../types.js";

export interface ManifestConfig extends OpenAIConfig {}

/**
 * Manifest API adapter
 *
 * Manifest is an open-source, OpenAI-compatible gateway for AI agents.
 * It exposes a single endpoint in front of multiple providers (API keys,
 * subscriptions, local models), with per-message cost/token tracking and
 * automatic fallback when a provider fails.
 *
 * The served model is resolved server-side from the user's dashboard
 * configuration, so requests always target the single `auto` model id.
 *
 * @see https://github.com/mnfst/manifest
 */
export class ManifestApi extends OpenAIApi {
  constructor(config: ManifestConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "https://app.manifest.build/v1/",
    });
  }
}

export default ManifestApi;
