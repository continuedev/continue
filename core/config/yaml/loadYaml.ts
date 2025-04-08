import fs from "node:fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  FQSN,
  ModelRole,
  PlatformClient,
  RegistryClient,
  SecretResult,
  unrollAssistantFromContent,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { fetchwithRequestOptions } from "@continuedev/fetch";

import {
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeInfo,
  IdeSettings,
} from "../..";
import { slashFromCustomCommand } from "../../commands";
import { AllRerankers } from "../../context/allRerankers";
import { MCPManagerSingleton } from "../../context/mcp";
import CodebaseContextProvider from "../../context/providers/CodebaseContextProvider";
import DocsContextProvider from "../../context/providers/DocsContextProvider";
import FileContextProvider from "../../context/providers/FileContextProvider";
import { contextProviderClassFromName } from "../../context/providers/index";
import { ControlPlaneClient } from "../../control-plane/client";
import { allEmbeddingsProviders } from "../../indexing/allEmbeddingsProviders";
import FreeTrial from "../../llm/llms/FreeTrial";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { slashCommandFromPromptFileV1 } from "../../promptFiles/v1/slashCommandFromPromptFile";
import { getAllPromptFiles } from "../../promptFiles/v2/getPromptFiles";
import { allTools } from "../../tools";
import { GlobalContext } from "../../util/GlobalContext";
import { getConfigYamlPath } from "../../util/paths";
import { getSystemPromptDotFile } from "../getSystemPromptDotFile";
import { PlatformConfigMetadata } from "../profile/PlatformProfileLoader";
import { modifyAnyConfigWithSharedConfig } from "../sharedConfig";

import { getControlPlaneEnvSync } from "../../control-plane/env";
import { LLMConfigurationStatuses } from "../../llm/constants";
import { llmsFromModelConfig } from "./models";

export class LocalPlatformClient implements PlatformClient {
  constructor(
    private orgScopeId: string | null,
    private readonly client: ControlPlaneClient,
  ) {}

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    const response = await this.client.resolveFQSNs(fqsns, this.orgScopeId);
    return response;
  }
}

async function loadConfigYaml(
  rawYaml: string,
  overrideConfigYaml: AssistantUnrolled | undefined,
  controlPlaneClient: ControlPlaneClient,
  orgScopeId: string | null,
  ideSettings: IdeSettings,
): Promise<ConfigResult<AssistantUnrolled>> {
  let config =
    overrideConfigYaml ??
    // This is how we allow use of blocks locally
    (await unrollAssistantFromContent(
      {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      rawYaml,
      new RegistryClient(
        await controlPlaneClient.getAccessToken(),
        getControlPlaneEnvSync(
          ideSettings.continueTestEnvironment,
          ideSettings.enableControlServerBeta,
        ).CONTROL_PLANE_URL,
      ),
      {
        currentUserSlug: "",
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(orgScopeId, controlPlaneClient),
        renderSecrets: true,
      },
    ));
  const errors = validateConfigYaml(config);

  if (errors?.some((error) => error.fatal)) {
    return {
      errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  return {
    config,
    errors,
    configLoadInterrupted: false,
  };
}

async function configYamlToContinueConfig(
  config: AssistantUnrolled,
  ide: IDE,
  ideSettings: IdeSettings,
  ideInfo: IdeInfo,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  allowFreeTrial: boolean = true,
): Promise<{ config: ContinueConfig; errors: ConfigValidationError[] }> {
  const localErrors: ConfigValidationError[] = [];
  const continueConfig: ContinueConfig = {
    slashCommands: [],
    models: [],
    tools: [...allTools],
    mcpServerStatuses: [],
    systemMessage: undefined,
    experimental: {
      modelContextProtocolServers: config.mcpServers?.map((mcpServer) => ({
        transport: {
          type: "stdio",
          command: mcpServer.command,
          args: mcpServer.args ?? [],
          env: mcpServer.env,
        },
      })),
    },
    docs: config.docs?.map((doc) => ({
      title: doc.name,
      startUrl: doc.startUrl,
      rootUrl: doc.rootUrl,
      faviconUrl: doc.faviconUrl,
    })),
    rules: config.rules,
    contextProviders: [],
    modelsByRole: {
      chat: [],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      summarize: [],
    },
    selectedModelByRole: {
      chat: null, // not currently used - defaultModel on GUI is used
      edit: null, // not currently used
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      summarize: null,
    },
    data: config.data,
  };

  // Prompt files -
  try {
    const promptFiles = await getAllPromptFiles(ide, undefined, true);

    for (const file of promptFiles) {
      try {
        const slashCommand = slashCommandFromPromptFileV1(
          file.path,
          file.content,
        );
        if (slashCommand) {
          continueConfig.slashCommands?.push(slashCommand);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to convert prompt file ${file.path} to slash command: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Error loading local prompt files: ${e instanceof Error ? e.message : e}`,
    });
  }

  config.prompts?.forEach((prompt) => {
    try {
      const slashCommand = slashFromCustomCommand(prompt);
      continueConfig.slashCommands?.push(slashCommand);
    } catch (e) {
      localErrors.push({
        message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
        fatal: false,
      });
    }
  });

  // Models
  const modelsArrayRoles: ModelRole[] = ["chat", "summarize", "apply", "edit"];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? modelsArrayRoles; // Default to all 4 chat-esque roles if not specified
    try {
      const llms = await llmsFromModelConfig({
        model,
        ide,
        uniqueId,
        ideSettings,
        writeLog,
        platformConfigMetadata,
        config: continueConfig,
      });

      if (modelsArrayRoles.some((role) => model.roles?.includes(role))) {
        continueConfig.models.push(...llms);
      }

      if (model.roles?.includes("chat")) {
        continueConfig.modelsByRole.chat.push(...llms);
      }

      if (model.roles?.includes("summarize")) {
        continueConfig.modelsByRole.summarize.push(...llms);
      }

      if (model.roles?.includes("apply")) {
        continueConfig.modelsByRole.apply.push(...llms);

        if (
          llms.every(
            (llm) =>
              llm.getConfigurationStatus() !== LLMConfigurationStatuses.VALID,
          )
        ) {
          const chatModelForApplyFallback = config.models?.find((model) =>
            model.roles?.includes("chat"),
          );
          if (chatModelForApplyFallback) {
            const [chatLlmForApplyFallback] = await llmsFromModelConfig({
              model: chatModelForApplyFallback,
              ide,
              uniqueId,
              ideSettings,
              writeLog,
              platformConfigMetadata,
              config: continueConfig,
            });

            continueConfig.modelsByRole.apply.unshift(chatLlmForApplyFallback);
            continueConfig.selectedModelByRole.apply = chatLlmForApplyFallback;
          }
        }
      }

      if (model.roles?.includes("edit")) {
        continueConfig.modelsByRole.edit.push(...llms);
      }

      if (model.roles?.includes("autocomplete")) {
        continueConfig.modelsByRole.autocomplete.push(...llms);
      }

      if (model.roles?.includes("embed")) {
        const { provider, ...options } = model;
        const embeddingsProviderClass = allEmbeddingsProviders[provider];
        if (embeddingsProviderClass) {
          if (
            embeddingsProviderClass.name === "_TransformersJsEmbeddingsProvider"
          ) {
            continueConfig.modelsByRole.embed.push(
              new embeddingsProviderClass(),
            );
          } else {
            continueConfig.modelsByRole.embed.push(
              new embeddingsProviderClass(
                {
                  ...options,
                  title: options.name,
                },
                (url: string | URL, init: any) =>
                  fetchwithRequestOptions(url, init, {
                    ...options.requestOptions,
                  }),
              ),
            );
          }
        } else {
          localErrors.push({
            fatal: false,
            message: `Unsupported embeddings model provider found: ${provider}`,
          });
        }
      }

      if (model.roles?.includes("rerank")) {
        const { provider, ...options } = model;
        const rerankerClass = AllRerankers[provider];
        if (rerankerClass) {
          continueConfig.modelsByRole.rerank.push(
            new rerankerClass(
              {
                ...options,
                title: options.name,
              },
              (url: string | URL, init: any) =>
                fetchwithRequestOptions(url, init, {
                  ...options.requestOptions,
                }),
            ),
          );
        } else {
          localErrors.push({
            fatal: false,
            message: `Unsupported reranking model provider found: ${provider}`,
          });
        }
      }
    } catch (e) {
      localErrors.push({
        fatal: false,
        message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // Add transformers js to the embed models in vs code if not already added
  if (
    ideInfo.ideType === "vscode" &&
    !continueConfig.modelsByRole.embed.find(
      (m) => m.providerName === "transformers.js",
    )
  ) {
    continueConfig.modelsByRole.embed.push(
      new TransformersJsEmbeddingsProvider(),
    );
  }

  if (allowFreeTrial) {
    // Obtain auth token (iff free trial being used)
    const freeTrialModels = continueConfig.models.filter(
      (model) => model.providerName === "free-trial",
    );
    if (freeTrialModels.length > 0) {
      try {
        const ghAuthToken = await ide.getGitHubAuthToken({});
        for (const model of freeTrialModels) {
          (model as FreeTrial).setupGhAuthToken(ghAuthToken);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to obtain GitHub auth token for free trial:\n${e instanceof Error ? e.message : e}`,
        });
        // Remove free trial models
        continueConfig.models = continueConfig.models.filter(
          (model) => model.providerName !== "free-trial",
        );
      }
    }
  } else {
    // Remove free trial models
    continueConfig.models = continueConfig.models.filter(
      (model) => model.providerName !== "free-trial",
    );
  }

  // Context providers
  const codebaseContextParams: IContextProvider[] =
    (config.context || []).find((cp) => cp.provider === "codebase")?.params ||
    {};
  const DEFAULT_CONTEXT_PROVIDERS = [
    new FileContextProvider({}),
    new CodebaseContextProvider(codebaseContextParams),
  ];

  const DEFAULT_CONTEXT_PROVIDERS_TITLES = DEFAULT_CONTEXT_PROVIDERS.map(
    ({ description: { title } }) => title,
  );

  continueConfig.contextProviders = (config.context
    ?.map((context) => {
      const cls = contextProviderClassFromName(context.provider) as any;
      if (!cls) {
        if (!DEFAULT_CONTEXT_PROVIDERS_TITLES.includes(context.provider)) {
          localErrors.push({
            fatal: false,
            message: `Unknown context provider ${context.provider}`,
          });
        }
        return undefined;
      }
      const instance: IContextProvider = new cls(context.params ?? {});
      return instance;
    })
    .filter((p) => !!p) ?? []) as IContextProvider[];
  continueConfig.contextProviders.push(...DEFAULT_CONTEXT_PROVIDERS);

  if (
    continueConfig.docs?.length &&
    !continueConfig.contextProviders?.some(
      (cp) => cp.description.title === "docs",
    )
  ) {
    continueConfig.contextProviders.push(new DocsContextProvider({}));
  }

  // Trigger MCP server refreshes (Config is reloaded again once connected!)
  const mcpManager = MCPManagerSingleton.getInstance();
  mcpManager.setConnections(
    (config.mcpServers ?? []).map((server) => ({
      id: server.name,
      name: server.name,
      transport: {
        type: "stdio",
        args: [],
        ...server,
      },
    })),
    false,
  );

  return { config: continueConfig, errors: localErrors };
}

export async function loadContinueConfigFromYaml(
  ide: IDE,
  ideSettings: IdeSettings,
  ideInfo: IdeInfo,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  overrideConfigYaml: AssistantUnrolled | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  controlPlaneClient: ControlPlaneClient,
  configYamlPath: string | undefined,
  orgScopeId: string | null,
): Promise<ConfigResult<ContinueConfig>> {
  const rawYaml =
    overrideConfigYaml === undefined
      ? fs.readFileSync(
          configYamlPath ?? getConfigYamlPath(ideInfo.ideType),
          "utf-8",
        )
      : "";

  const configYamlResult = await loadConfigYaml(
    rawYaml,
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
  );

  if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
    return {
      errors: configYamlResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: continueConfig, errors: localErrors } =
    await configYamlToContinueConfig(
      configYamlResult.config,
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      writeLog,
      workOsAccessToken,
      platformConfigMetadata,
    );

  try {
    const systemPromptDotFile = await getSystemPromptDotFile(ide);
    if (systemPromptDotFile) {
      if (continueConfig.systemMessage) {
        continueConfig.systemMessage += "\n\n" + systemPromptDotFile;
      } else {
        continueConfig.systemMessage = systemPromptDotFile;
      }
    }
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Failed to load system prompt dot file: ${e instanceof Error ? e.message : e}`,
    });
  }

  // Apply shared config
  // TODO: override several of these values with user/org shared config
  // Don't try catch this - has security implications and failure should be fatal
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(
    continueConfig,
    sharedConfig,
  );
  if (withShared.allowAnonymousTelemetry === undefined) {
    withShared.allowAnonymousTelemetry = true;
  }

  return {
    config: withShared,
    errors: [...(configYamlResult.errors ?? []), ...localErrors],
    configLoadInterrupted: false,
  };
}
