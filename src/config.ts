import {
  AssistantUnrolled,
  ModelConfig,
  RegistryClient,
  unrollAssistant,
} from "@continuedev/config-yaml";
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
import chalk from "chalk";
import { dirname } from "node:path";
import {
  AuthConfig,
  getAccessToken,
  getAssistantSlug,
  getOrganizationId,
} from "./auth/workos.js";
import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { env } from "./env.js";
import { MCPService } from "./mcp.js";

export function getLlmApi(
  assistant: AssistantUnrolled,
  authConfig: AuthConfig
): [BaseLlmApi, ModelConfig] {
  const model = assistant.models?.find((model) =>
    model?.roles?.includes("chat")
  );

  if (!model) {
    throw new Error(
      "No models with the chat role found in the configured assistant"
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
      "Failed to initialized LLM. Please check your configuration."
    );
  }

  return [llmApi, model];
}

async function loadConfigYaml(
  accessToken: string | null,
  filePath: string,
  organizationId: string | null,
  apiClient: DefaultApiInterface
): Promise<AssistantUnrolled> {
  const unrollResult = await unrollAssistant(
    { filePath, uriType: "file" },
    new RegistryClient({
      accessToken: accessToken ?? undefined,
      apiBase: env.apiBase,
      rootPath: dirname(filePath),
    }),
    {
      currentUserSlug: "",
      alwaysUseProxy: false,
      orgScopeId: organizationId,
      renderSecrets: true,
      platformClient: new CLIPlatformClient(organizationId, apiClient),
      onPremProxyUrl: null,
    }
  );

  const errorDetails = unrollResult.errors;
  if (!unrollResult.config) {
    throw new Error(`Failed to load config file:\n${errorDetails}`);
  } else if (errorDetails?.length) {
    const warnings =
      errorDetails?.length > 1
        ? errorDetails.map((d) => `\n- ${d.message}`)
        : errorDetails[0].message;
    console.warn(chalk.dim(`Warning: ${warnings}`));
  }

  return unrollResult.config;
}

export function getApiClient(
  accessToken: string | undefined | null
): DefaultApi {
  return new DefaultApi(
    new Configuration({
      basePath: env.apiBase.replace(/\/$/, ""),
      accessToken: accessToken ?? undefined,
    })
  );
}

export async function loadConfig(
  authConfig: AuthConfig,
  config: string | undefined,
  organizationId: string | null,
  apiClient?: DefaultApiInterface
): Promise<AssistantUnrolled> {
  if (!apiClient) {
    apiClient = getApiClient(authConfig?.accessToken);
  }

  if (!config) {
    // Check if there's a saved assistant slug in auth config
    const assistantSlug = getAssistantSlug(authConfig);
    if (assistantSlug) {
      // Use the saved assistant slug
      config = assistantSlug;
    } else {
      // Fall back to listing assistants and taking the first one
      const assistants = await apiClient.listAssistants({
        alwaysUseProxy: "false",
        organizationId: organizationId ?? undefined,
      });

      if (assistants.length === 0) {
        // In case the user doesn't have any assistants, we fall back to a default - TODO
        const resp = await apiClient.getAssistant({
          ownerSlug: "continuedev",
          packageSlug: "default-agent",
          organizationId: organizationId ?? undefined,
        });

        if (!resp.configResult.config) {
          throw new Error("Failed to load default agent.");
        }
        return resp.configResult.config as AssistantUnrolled;
      }

      const result = assistants[0].configResult;

      if (result.errors?.length || !result.config) {
        throw new Error(
          result.errors?.join("\n") ?? "Failed to load assistant."
        );
      }

      return result.config as AssistantUnrolled;
    }
  }

  if (
    config.startsWith(".") ||
    config.startsWith("/") ||
    config.startsWith("~")
  ) {
    // Load from file
    const configYaml = await loadConfigYaml(
      authConfig?.accessToken ?? null,
      config,
      organizationId,
      apiClient
    );

    return configYaml;
  } else {
    // Load from slug
    const [ownerSlug, packageSlug] = config.split("/");
    const resp = await apiClient.getAssistant({
      ownerSlug,
      packageSlug,
      alwaysUseProxy: "false",
      organizationId: organizationId ?? undefined,
    });

    const result = resp.configResult;
    if (result.errors?.length || !result.config) {
      throw new Error(result.errors?.join("\n") ?? "Failed to load assistant.");
    }

    return result.config as AssistantUnrolled;
  }
}

export async function initialize(
  authConfig: AuthConfig,
  configPath: string | undefined
): Promise<{
  config: AssistantUnrolled;
  llmApi: BaseLlmApi;
  model: ModelConfig;
  mcpService: MCPService;
  apiClient: DefaultApiInterface;
}> {
  const organizationId = getOrganizationId(authConfig);
  const apiClient = getApiClient(authConfig?.accessToken);
  const config = await loadConfig(
    authConfig,
    configPath,
    organizationId,
    apiClient
  );
  const [llmApi, model] = getLlmApi(config, authConfig);
  const mcpService = await MCPService.create(config);

  return { config, llmApi, model, mcpService, apiClient };
}
