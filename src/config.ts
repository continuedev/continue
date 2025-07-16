import {
  AssistantUnrolled,
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
import { dirname } from "node:path";
import {
  AuthConfig,
  getAccessToken,
  getOrganizationId,
} from "./auth/workos.js";
import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { env } from "./env.js";
import { MCPService } from "./mcp.js";

export function getLlmApi(
  assistant: AssistantUnrolled,
  authConfig: AuthConfig
): [BaseLlmApi, string] {
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

  return [llmApi, model.model];
}

async function loadConfigYaml(
  accessToken: string | null,
  currentUserSlug: string,
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
      currentUserSlug,
      alwaysUseProxy: false,
      orgScopeId: organizationId,
      renderSecrets: true,
      platformClient: new CLIPlatformClient(organizationId, apiClient),
      onPremProxyUrl: null,
    }
  );

  if (unrollResult.errors?.length || !unrollResult.config) {
    const errorDetails = unrollResult.errors?.join("\n") ?? "Unknown error";
    throw new Error(`Failed to load config file:\n${errorDetails}`);
  }

  return unrollResult.config;
}

export async function loadConfig(
  accessToken: string | null,
  config: string | undefined,
  organizationId: string | null
): Promise<AssistantUnrolled> {
  const apiClient = new DefaultApi(
    new Configuration({
      accessToken: accessToken ?? undefined,
    })
  );

  if (!config) {
    // Fall back to listing assistants and taking the first one
    const assistants = await apiClient.listAssistants({
      alwaysUseProxy: "false",
      organizationId: organizationId ?? undefined,
    });

    const result = assistants[0].configResult;
    if (result.errors?.length || !result.config) {
      throw new Error(result.errors?.join("\n") ?? "Failed to load assistant.");
    }

    return result.config as AssistantUnrolled;
  } else if (config.startsWith(".") || config.startsWith("/")) {
    // Load from file
    const configYaml = await loadConfigYaml(
      accessToken,
      "TODO", // TODO currentUserSlug
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
  model: string;
  mcpService: MCPService;
}> {
  const accessToken = getAccessToken(authConfig);
  const organizationId = getOrganizationId(authConfig);

  const config = await loadConfig(accessToken, configPath, organizationId);
  const [llmApi, model] = getLlmApi(config, authConfig);
  const mcpService = await MCPService.create(config);

  return { config, llmApi, model, mcpService };
}
