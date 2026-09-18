import {
  AI_GATEWAY_BASE_URL,
  assertGatewayBaseUrl,
} from "@continuedev/openai-adapters";
import type { LLMOptions } from "../..";
import { BaseLLM } from "../index";
import type { LlmApiRequestType } from "../openaiTypeConverters";

export default class VercelAIGateway extends BaseLLM {
  static providerName = "vercel-ai-gateway";
  static defaultOptions: Partial<LLMOptions> = { apiBase: AI_GATEWAY_BASE_URL };
  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = ["*"];
  protected supportsReasoningContentField = true;

  constructor(options: LLMOptions) {
    assertGatewayBaseUrl(options.apiBase);
    if (
      options.model !== "AUTODETECT" &&
      !/^[a-z0-9-]+\/[^\s]+$/.test(options.model)
    ) {
      throw new Error(
        "Use a Gateway model ID in publisher/model format, such as anthropic/claude-sonnet-4.6.",
      );
    }
    super({
      ...options,
      apiBase: AI_GATEWAY_BASE_URL,
      apiKey: options.apiKey?.trim() || process.env.AI_GATEWAY_API_KEY?.trim(),
      template: "none",
    });
    this.templateMessages = undefined;
  }

  supportsCompletions() {
    return false;
  }
  supportsFim() {
    return true;
  }
  async listGatewayModels() {
    return (await this.openaiAdapter!.list()) as Array<{
      id: string;
      name?: string;
      type?: string;
      tags?: string[];
      context_window?: number;
      max_tokens?: number;
    }>;
  }
  async listModels() {
    const type = this.roles?.includes("embed")
      ? "embedding"
      : this.roles?.includes("rerank")
        ? "reranking"
        : "language";
    return (await this.listGatewayModels())
      .filter((model) => !model.type || model.type === type)
      .map((model) => model.id);
  }
}
