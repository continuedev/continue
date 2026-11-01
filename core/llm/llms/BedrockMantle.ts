import {
  isMantleRegion,
  MANTLE_REGIONS,
  mantleBaseUrl,
  mantleModelOptions,
  normalizeMantlePrefix,
  type MantleModelOption,
} from "@continuedev/openai-adapters";
import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/** Explains why a region can't be used with Mantle, or undefined if it can. */
export function mantleRegionError(
  region: string | undefined,
): string | undefined {
  const r = region ?? "us-east-1";
  return isMantleRegion(r)
    ? undefined
    : `bedrock-mantle isn't available in ${r}. Mantle regions: ${MANTLE_REGIONS.join(", ")}.`;
}

/**
 * Amazon Bedrock Mantle: the OpenAI-compatible endpoint at
 * `bedrock-mantle.<region>.api.aws`, used with a Bedrock API key.
 *
 * Chat goes through the shared adapter (`openai-adapters` BedrockMantleApi),
 * which builds the URL from `region`, learns the right path prefix and token
 * parameter for each model, and adds actionable error hints.
 *
 *   models:
 *     - name: GPT OSS
 *       provider: bedrock-mantle
 *       model: openai.gpt-oss-120b
 *       apiKey: ${{ secrets.BEDROCK_API_KEY }}
 *       env:
 *         region: us-east-1
 *         # optional: mantlePathPrefix: /openai/v1, maxTokensParam: max_completion_tokens
 */
class BedrockMantle extends OpenAI {
  static providerName = "bedrock-mantle";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    maxEmbeddingBatchSize: 128,
  };

  constructor(options: LLMOptions) {
    const region = options.region ?? "us-east-1";
    const prefix = normalizeMantlePrefix(options.mantlePathPrefix);
    super({
      ...options,
      // The adapter is created inside BaseLLM's constructor, before our own
      // fields exist, so everything it needs travels through the options.
      apiKey: options.apiKey || process.env.AWS_BEARER_TOKEN_BEDROCK,
      env: {
        ...options.env,
        region,
        ...(prefix ? { mantlePathPrefix: prefix } : {}),
        ...(options.maxTokensParam
          ? { maxTokensParam: options.maxTokensParam }
          : {}),
      },
    });

    // For the few OpenAI methods that use apiBase directly. The adapter only
    // treats apiBase as fixed when the user set it.
    if (!options.apiBase) {
      this.apiBase = mantleBaseUrl(region, prefix);
    }
  }

  /** All model IDs the account can use on Mantle (`GET /v1/models`). */
  async listModels(): Promise<string[]> {
    if (!this.openaiAdapter) return [];
    const models = await this.openaiAdapter.list();
    return models.map((m) => m.id);
  }

  async listAvailableModels(): Promise<MantleModelOption[]> {
    return mantleModelOptions(await this.listModels());
  }

  /** Send a tiny request to verify the key, region and model. */
  async testModel(): Promise<{
    modelId: string;
    latencyMs: number;
    reply: string;
  }> {
    const started = Date.now();
    const reply = await this.chat(
      [{ role: "user", content: "Reply with the single word: ok" }],
      new AbortController().signal,
      { maxTokens: 16 },
    );
    return {
      modelId: this.model,
      latencyMs: Date.now() - started,
      reply: reply.content.trim(),
    };
  }
}

export default BedrockMantle;
