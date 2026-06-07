import { ChatCompletionCreateParams } from "openai/resources/index";

import { OpenAIConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { applyAnthropicCachingToOpenRouterBody } from "./OpenRouterCaching.js";

export interface OrcaRouterConfig extends OpenAIConfig {
  cachingStrategy?: import("./AnthropicCachingStrategies.js").CachingStrategyName;
}

export const ORCAROUTER_HEADERS: Record<string, string> = {
  "HTTP-Referer": "https://www.continue.dev/",
  "X-Title": "Continue",
  "User-Agent": "Continue/IDE",
  "X-Continue-Provider": "orcarouter",
};

export class OrcaRouterApi extends OpenAIApi {
  constructor(config: OrcaRouterConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "https://api.orcarouter.ai/v1/",
    });
  }

  /**
   * Override headers to include OrcaRouter attribution headers so the
   * upstream router can identify Continue traffic and apply per-client
   * analytics / routing decisions.
   */
  protected override getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
      ...ORCAROUTER_HEADERS,
    };
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) {
      return false;
    }
    return model.toLowerCase().includes("claude");
  }

  override modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    const modifiedBody = super.modifyChatBody(body);

    if (!this.isAnthropicModel(modifiedBody.model)) {
      return modifiedBody;
    }

    applyAnthropicCachingToOpenRouterBody(
      modifiedBody as unknown as ChatCompletionCreateParams,
      (this.config as OrcaRouterConfig).cachingStrategy ?? "systemAndTools",
    );

    return modifiedBody;
  }
}

export default OrcaRouterApi;
