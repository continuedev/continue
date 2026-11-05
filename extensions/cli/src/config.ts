import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import {
  BaseLlmApi,
  constructLlmApi,
  LLMConfig,
} from "@continuedev/openai-adapters";
import {
  Configuration,
  DefaultApi,
} from "@continuedev/sdk/dist/api/dist/index.js";

import { AuthConfig } from "./auth/workos.js";
import { env } from "./env.js";
import { getUniqueId } from "./util/uniqueId.js";
import { getVersion } from "./version.js";

/**
 * Creates user-agent header value for CLI requests
 */
function getUserAgent(): string {
  const version = getVersion();
  return `Continue-CLI/${version}`;
}

/**
 * Merges user-agent header into request options
 */
function _mergeUserAgentIntoRequestOptions(
  requestOptions: ModelConfig["requestOptions"],
): ModelConfig["requestOptions"] {
  return {
    ...requestOptions,
    headers: {
      ...requestOptions?.headers,
      "user-agent": getUserAgent(),
      "x-continue-unique-id": getUniqueId(),
    },
  };
}

/**
 * The caching settings for a Bedrock model. The CLI only runs agent loops, so
 * the chat window's default for Agent mode applies: when the model config says
 * nothing about caching, a Claude model caches with Auto. A week of real agent
 * traffic read 12 to 28 times per token written, and Auto came within 0.7
 * points of the best lifetime for each conversation
 * (plans/cache-real-world-data.md). Anything the config says wins, including
 * `promptCaching: false`. Non-Claude models are left alone: they reject a
 * cache point.
 */
export function bedrockCachingSettings(model: ModelConfig): {
  promptCaching?: boolean;
  cacheBehavior?: ModelConfig["cacheBehavior"];
} {
  const promptCaching = model.defaultCompletionOptions?.promptCaching;
  const behavior = model.cacheBehavior;
  const silent =
    promptCaching === undefined &&
    behavior?.cacheConversation === undefined &&
    behavior?.cacheSystemMessage === undefined;
  if (silent && /claude/i.test(model.model)) {
    return {
      promptCaching: true,
      cacheBehavior: { ...behavior, ttl: behavior?.ttl ?? "auto" },
    };
  }
  return { promptCaching, cacheBehavior: behavior };
}

/**
 * The lifetime for an Anthropic model: what the config names, else Auto when
 * the config says nothing about caching (the same default as the Bedrock
 * path). The adapter already caches unless its `cachingStrategy` is `none`.
 */
export function anthropicTtl(
  model: ModelConfig,
): "auto" | "5m" | "1h" | undefined {
  if (model.cacheBehavior?.ttl) return model.cacheBehavior.ttl;
  const silent =
    model.defaultCompletionOptions?.promptCaching === undefined &&
    model.cacheBehavior?.cacheConversation === undefined &&
    model.cacheBehavior?.cacheSystemMessage === undefined;
  return silent ? "auto" : undefined;
}

/**
 * Creates an LLM API instance from a ModelConfig and auth configuration
 */
export function createLlmApi(
  model: ModelConfig,
  _authConfig: AuthConfig,
): BaseLlmApi | null {
  const config: LLMConfig = {
    provider: model.provider as any,
    model: model.model,
    apiKey: model.apiKey,
    apiBase: model.apiBase,
    requestOptions: model.requestOptions,
    env: model.env,
    // Prompt caching settings. The Bedrock adapter reads `promptCaching` and
    // `cacheBehavior`; see `bedrockCachingSettings` for what it gets when the
    // model config says nothing. The Anthropic adapter has its own
    // `cachingStrategy` (caching is on unless that is `none`) and reads only the
    // lifetime, so that is all it is given.
    ...(model.provider === "bedrock"
      ? bedrockCachingSettings(model)
      : model.provider === "anthropic" && anthropicTtl(model)
        ? { cacheBehavior: { ttl: anthropicTtl(model) } }
        : {}),
  };

  return constructLlmApi(config) ?? null;
}

export function getLlmApi(
  assistant: AssistantUnrolled,
  authConfig: AuthConfig,
): [BaseLlmApi, ModelConfig] {
  if (!assistant.models || assistant.models.length === 0) {
    throw new Error("No models found in the configured assistant");
  }

  const model = assistant.models?.find(
    (model) =>
      model?.roles?.includes("chat") || (model && model.roles === undefined),
  );

  if (!model) {
    throw new Error(
      "No models with the chat role found in the configured assistant",
    );
  }

  const llmApi = createLlmApi(model, authConfig);

  if (!llmApi) {
    throw new Error(
      "Failed to initialize LLM. Please check your configuration.",
    );
  }

  return [llmApi, model];
}

export function getApiClient(
  accessToken: string | undefined | null,
): DefaultApi {
  return new DefaultApi(
    new Configuration({
      basePath: env.apiBase.replace(/\/$/, ""),
      accessToken: accessToken ?? undefined,
    }),
  );
}
