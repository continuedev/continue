import { AssistantUnrolled } from "@continuedev/config-yaml";
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

  const config: LLMConfig =
    model.provider === "continue-proxy"
      ? {
          provider: model.provider,
          requestOptions: model.requestOptions,
          apiBase: model.apiBase,
          apiKey: authConfig.accessToken,
          env: {
            apiKeyLocation: (model as any).apiKeyLocation,
            // envSecretLocations: model.env,
            orgScopeId: authConfig.organizationId ?? null,
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

export async function loadConfig(
  accessToken: string | undefined,
  config: string | undefined,
  organizationId: string | undefined
): Promise<AssistantUnrolled> {
  const apiClient = new DefaultApi(
    new Configuration({
      accessToken,
    })
  );

  if (!config) {
    // Fall back to listing assistants and taking the first one
    const assistants = await apiClient.listAssistants({
      alwaysUseProxy: "false",
      organizationId,
    });

    const result = assistants[0].configResult;
    if (result.errors?.length || !result.config) {
      throw new Error(result.errors?.join("\n") ?? "Failed to load assistant.");
    }

    return result.config as AssistantUnrolled;
  } else if (config.startsWith(".") || config.startsWith("/")) {
    // Load from file
    throw new Error("Loading from file is not supported yet.");
    // return loadAssistantFromFile(config);
  } else {
    // Load from slug
    const [ownerSlug, packageSlug] = config.split("/");
    const resp = await apiClient.getAssistant({
      ownerSlug,
      packageSlug,
      alwaysUseProxy: "false",
      organizationId,
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
  const config = await loadConfig(
    authConfig.accessToken,
    configPath,
    authConfig.organizationId ?? undefined
  );
  const [llmApi, model] = getLlmApi(config, authConfig);
  const mcpService = await MCPService.create(config);

  return { config, llmApi, model, mcpService };
}
