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

import {
  AuthConfig,
  getAccessToken,
  getOrganizationId,
} from "./auth/workos.js";
import { env } from "./env.js";
import { posthogService } from "./telemetry/posthogService.js";
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
function mergeUserAgentIntoRequestOptions(
  requestOptions: ModelConfig["requestOptions"],
): ModelConfig["requestOptions"] {
  return {
    ...requestOptions,
    headers: {
      ...requestOptions?.headers,
      "user-agent": getUserAgent(),
      "x-continue-unique-id": posthogService.uniqueId,
    },
  };
}

/**
 * Creates an LLM API instance from a ModelConfig and auth configuration
 * Handles special logic for continue-proxy provider and constructs the API
 */
export function createLlmApi(
  model: ModelConfig,
  authConfig: AuthConfig | null,
): BaseLlmApi | null {
  const accessToken = getAccessToken(authConfig);
  const organizationId = getOrganizationId(authConfig);

  const config: LLMConfig =
    model.provider === "continue-proxy"
      ? {
          provider: model.provider,
          requestOptions: mergeUserAgentIntoRequestOptions(
            model.requestOptions,
          ),
          apiBase: model.apiBase,
          apiKey: accessToken ?? undefined,
          env: {
            apiKeyLocation: (model as any).apiKeyLocation,
            orgScopeId: organizationId ?? null,
            proxyUrl:
              (model as { onPremProxyUrl: string | undefined })
                .onPremProxyUrl ?? (env.apiBase ? env.apiBase : undefined),
          },
        }
      : {
          provider: model.provider as any,
          apiKey: model.apiKey,
          apiBase: model.apiBase,
          requestOptions: model.requestOptions,
          env: model.env,
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
