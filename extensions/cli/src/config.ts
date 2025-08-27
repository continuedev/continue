import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import {
  BaseLlmApi,
  constructLlmApi,
  LLMConfig,
} from "@continuedev/openai-adapters";
import {
  Configuration,
  DefaultApi,
  DefaultApiInterface,
} from "@continuedev/sdk/dist/api/dist/index.js";

import {
  AuthConfig,
  getAccessToken,
  getOrganizationId,
} from "./auth/workos.js";
import { loadConfiguration } from "./configLoader.js";
import { env } from "./env.js";
import { MCPService } from "./services/MCPService.js";

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

  const accessToken = getAccessToken(authConfig);
  const organizationId = getOrganizationId(authConfig);

  const config: LLMConfig =
    model.provider === "continue-proxy"
      ? {
          provider: model.provider,
          requestOptions: model.requestOptions,
          apiBase: model.apiBase,
          apiKey: accessToken ?? undefined,
          env: {
            apiKeyLocation: (model as any).apiKeyLocation,
            // envSecretLocations: model.env,
            orgScopeId: organizationId,
            proxyUrl: undefined, // TODO
          },
        }
      : {
          provider: model.provider as any,
          apiKey: model.apiKey,
          apiBase: model.apiBase,
          requestOptions: model.requestOptions,
          env: model.env,
        };

  const llmApi = constructLlmApi(config);

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

export async function initialize(
  authConfig: AuthConfig,
  configPath: string | undefined,
): Promise<{
  config: AssistantUnrolled;
  llmApi: BaseLlmApi;
  model: ModelConfig;
  mcpService: MCPService;
  apiClient: DefaultApiInterface;
}> {
  const apiClient = getApiClient(authConfig?.accessToken);
  const result = await loadConfiguration(authConfig, configPath, apiClient);
  const config = result.config;
  const [llmApi, model] = getLlmApi(config, authConfig);
  const mcpService = new MCPService();
  await mcpService.initialize(config, false);

  return { config, llmApi, model, mcpService, apiClient };
}
