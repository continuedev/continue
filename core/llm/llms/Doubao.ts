import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

/**
 * Doubao (豆包) is ByteDance's large-language-model family, served through
 * Volcengine Ark (火山方舟).
 *
 * API surface: OpenAI-compatible `/chat/completions` at
 * https://ark.cn-beijing.volces.com/api/v3/, Bearer-token auth. Unlike most
 * OpenAI-compatible providers, Doubao requires users to deploy a model as an
 * "endpoint" and use the endpoint ID (e.g. `ep-20240xxx-xxxxx`) as the model
 * identifier — though shared/public endpoints also expose model-name aliases
 * such as `doubao-1-5-pro-32k` and `doubao-seed-1-6`.
 *
 * Docs: https://www.volcengine.com/docs/82379
 */
class Doubao extends OpenAI {
  static providerName = "doubao";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://ark.cn-beijing.volces.com/api/v3/",
    // Ark model IDs are date-stamped (e.g. `doubao-seed-1-6-251015`) or are
    // Ark endpoint IDs (`ep-20240xxx-xxxxx`). We intentionally do NOT set a
    // default `model` here: picking a specific dated ID would go stale, and
    // users must in practice verify model availability against their own
    // Ark deployment. Requiring an explicit `model` forces a conscious
    // decision and avoids silent 404s from Ark.
    useLegacyCompletionsEndpoint: false,
  };
  maxStopWords: number | undefined = 4;
}

export default Doubao;
