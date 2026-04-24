import { DoubaoConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

/**
 * Doubao (豆包) served via Volcengine Ark.
 *
 * Uses the OpenAI-compatible `/chat/completions` endpoint. Unlike most
 * OpenAI-compatible services, Doubao recommends addressing models through
 * a deployed "endpoint ID" (e.g. `ep-20240xxx-xxxxx`), though shared model
 * aliases such as `doubao-1-5-pro-32k` also resolve on the public tenancy.
 *
 * No custom FIM: Ark does not expose a public `beta/completions` or
 * `[fill]`-prompt protocol today. If that changes we can override
 * `fimStream` the way Moonshot and Deepseek do.
 *
 * Reference: https://www.volcengine.com/docs/82379
 */
export class DoubaoApi extends OpenAIApi {
  apiBase: string = "https://ark.cn-beijing.volces.com/api/v3/";
  constructor(config: DoubaoConfig) {
    super({
      ...config,
      provider: "openai",
    });
  }
}
