import fs from "node:fs";

import {
  AssistantUnrolled,
  ConfigResult,
  ConfigValidationError,
  ModelRole,
  parseAssistantUnrolled,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { fetchwithRequestOptions } from "@continuedev/fetch";

import {
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeInfo,
  IdeSettings,
  SlashCommand,
} from "../..";
import { slashFromCustomCommand } from "../../commands";
import { AllRerankers } from "../../context/allRerankers";
import { MCPManagerSingleton } from "../../context/mcp";
import CodebaseContextProvider from "../../context/providers/CodebaseContextProvider";
import DocsContextProvider from "../../context/providers/DocsContextProvider";
import FileContextProvider from "../../context/providers/FileContextProvider";
import { contextProviderClassFromName } from "../../context/providers/index";
import PromptFilesContextProvider from "../../context/providers/PromptFilesContextProvider";
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

import { llmsFromModelConfig } from "./models";

async function loadConfigYaml(
  workspaceConfigs: string[],
  rawYaml: string,
  overrideConfigYaml: AssistantUnrolled | undefined,
  ide: IDE,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<AssistantUnrolled>> {
  // const ideSettings = await ide.getIdeSettings();
  let config =
    overrideConfigYaml ??
    // (ideSettings.continueTestEnvironment === "production"
    // ? await clientRenderHelper(rawYaml, ide, controlPlaneClient)
    // :
    parseAssistantUnrolled(rawYaml);
  // );
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
    errors: errors.map((error) => ({
      message: error.message,
      fatal: error.fatal,
    })),
    configLoadInterrupted: false,
  };
}

async function slashCommandsFromV1PromptFiles(
  ide: IDE,
): Promise<SlashCommand[]> {
  const slashCommands: SlashCommand[] = [];

  const promptFiles = await getAllPromptFiles(ide, undefined, true);

  for (const file of promptFiles) {
    const slashCommand = slashCommandFromPromptFileV1(file.path, file.content);
    if (slashCommand) {
      slashCommands.push(slashCommand);
    }
  }

  return slashCommands;
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
  const errors: ConfigValidationError[] = [];
  const continueConfig: ContinueConfig = {
    slashCommands: [
      ...(await slashCommandsFromV1PromptFiles(ide)),
      ...(config.prompts?.map(slashFromCustomCommand) ?? []),
    ],
    models: [],
    tools: allTools,
    systemMessage: config.rules?.join("\n"),
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

  // Models
  const modelsArrayRoles: ModelRole[] = ["chat", "summarize", "apply", "edit"];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? modelsArrayRoles; // Default to all 4 chat-esque roles if not specified
    const llms = await llmsFromModelConfig(
      model,
      ide,
      uniqueId,
      ideSettings,
      writeLog,
      platformConfigMetadata,
      continueConfig.systemMessage,
    );

    //
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
          continueConfig.modelsByRole.embed.push(new embeddingsProviderClass());
        } else {
          continueConfig.modelsByRole.embed.push(
            new embeddingsProviderClass(
              options,
              (url: string | URL, init: any) =>
                fetchwithRequestOptions(url, init, {
                  ...options.requestOptions,
                }),
            ),
          );
        }
      } else {
        errors.push({
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
          new rerankerClass(options, (url: string | URL, init: any) =>
            fetchwithRequestOptions(url, init, {
              ...options.requestOptions,
            }),
          ),
        );
      } else {
        errors.push({
          fatal: false,
          message: `Unsupported reranking model provider found: ${provider}`,
        });
      }
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
      const ghAuthToken = await ide.getGitHubAuthToken({});
      for (const model of freeTrialModels) {
        (model as FreeTrial).setupGhAuthToken(ghAuthToken);
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
    new PromptFilesContextProvider({}),
  ];

  const DEFAULT_CONTEXT_PROVIDERS_TITLES = DEFAULT_CONTEXT_PROVIDERS.map(
    ({ description: { title } }) => title,
  );

  continueConfig.contextProviders = (config.context
    ?.map((context) => {
      const cls = contextProviderClassFromName(context.provider) as any;
      if (!cls) {
        if (!DEFAULT_CONTEXT_PROVIDERS_TITLES.includes(context.provider)) {
          console.warn(`Unknown context provider ${context.provider}`);
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

  // Apply MCP if specified
  const mcpManager = MCPManagerSingleton.getInstance();
  await Promise.all(
    config.mcpServers?.map(async (server) => {
      const mcpId = server.name;
      const mcpConnection = mcpManager.createConnection(mcpId, {
        transport: {
          type: "stdio",
          args: [],
          ...server,
        },
      });
      if (!mcpConnection) {
        return;
      }

      const abortController = new AbortController();
      const mcpConnectionTimeout = setTimeout(
        () => abortController.abort(),
        5000,
      );

      try {
        const mcpError = await mcpConnection.modifyConfig(
          continueConfig,
          mcpId,
          abortController.signal,
          server.name,
          server.faviconUrl,
        );
        if (mcpError) {
          errors.push(mcpError);
        }
      } catch (e: any) {
        errors.push({
          fatal: false,
          message: `Failed to load MCP server: ${e.message}`,
        });
        if (e.name !== "AbortError") {
          throw e;
        }
      }
      clearTimeout(mcpConnectionTimeout);
    }) ?? [],
  );

  return { config: continueConfig, errors };
}

export async function loadContinueConfigFromYaml(
  ide: IDE,
  workspaceConfigs: string[],
  ideSettings: IdeSettings,
  ideInfo: IdeInfo,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  overrideConfigYaml: AssistantUnrolled | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<ContinueConfig>> {
  const rawYaml =
    overrideConfigYaml === undefined
      ? fs.readFileSync(getConfigYamlPath(ideInfo.ideType), "utf-8")
      : "";

  const configYamlResult = await loadConfigYaml(
    workspaceConfigs,
    rawYaml,
    overrideConfigYaml,
    ide,
    controlPlaneClient,
  );

  if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
    return {
      errors: configYamlResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: continueConfig, errors } = await configYamlToContinueConfig(
    configYamlResult.config,
    ide,
    ideSettings,
    ideInfo,
    uniqueId,
    writeLog,
    workOsAccessToken,
    platformConfigMetadata,
  );

  const systemPromptDotFile = await getSystemPromptDotFile(ide);
  if (systemPromptDotFile) {
    if (continueConfig.systemMessage) {
      continueConfig.systemMessage += "\n\n" + systemPromptDotFile;
    } else {
      continueConfig.systemMessage = systemPromptDotFile;
    }
  }

  // Apply shared config
  // TODO: override several of these values with user/org shared config
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
    errors: [...(configYamlResult.errors ?? []), ...errors],
    configLoadInterrupted: false,
  };
}
