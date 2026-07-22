import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

/**
 * Auxen — dedicated, OpenAI-compatible LLM endpoints (https://auxen.ai).
 *
 * Each Auxen instance is a per-customer dedicated GPU running one open-source
 * model behind a stable HTTPS endpoint of the form
 *   https://api.auxen.ai/v1/<instance_id>/v1
 * authenticated with a per-instance `auxk_*` bearer token.
 *
 * Because the apiBase is per-instance, no fixed defaultOptions.apiBase is
 * provided — users must set `apiBase` in their config to the URL issued by
 * the Auxen dashboard.
 */
class Auxen extends OpenAI {
  static providerName = "auxen";
  static defaultOptions: Partial<LLMOptions> = {
    // apiBase is per-instance — user must provide it via config.
  };
}

export default Auxen;
