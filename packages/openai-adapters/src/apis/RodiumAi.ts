import { ChatCompletionCreateParams } from "openai/resources/index";

import { OpenAIConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { applyAnthropicCachingToOpenRouterBody } from "./OpenRouterCaching.js";

export class RodiumAiApi extends OpenAIApi {
  constructor(config: OpenAIConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "https://api.rodiumai.io/v1/",
    });
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) {
      return false;
    }
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude") || modelLower.startsWith("anthropic/");
  }

  override modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    const modifiedBody = super.modifyChatBody(body);

    if (!this.isAnthropicModel(modifiedBody.model)) {
      return modifiedBody;
    }

    applyAnthropicCachingToOpenRouterBody(
      modifiedBody as unknown as ChatCompletionCreateParams,
      "systemAndTools",
    );

    return modifiedBody;
  }
}

export default RodiumAiApi;
