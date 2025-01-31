import fs from "node:fs";

import {
  AssistantUnrolled,
  ConfigResult,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { fetchwithRequestOptions } from "@continuedev/fetch";

import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  IdeType,
  SlashCommand,
} from "../..";
import { AllRerankers } from "../../context/allRerankers";
import { MCPManagerSingleton } from "../../context/mcp";
import CodebaseContextProvider from "../../context/providers/CodebaseContextProvider";
import FileContextProvider from "../../context/providers/FileContextProvider";
import { contextProviderClassFromName } from "../../context/providers/index";
import PromptFilesContextProvider from "../../context/providers/PromptFilesContextProvider";
import { ControlPlaneClient } from "../../control-plane/client";
import { allEmbeddingsProviders } from "../../indexing/allEmbeddingsProviders";
import FreeTrial from "../../llm/llms/FreeTrial";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { slashCommandFromPromptFileV1 } from "../../promptFiles/v1/slashCommandFromPromptFile";
import { getAllPromptFiles } from "../../promptFiles/v2/getPromptFiles";
import { getConfigYamlPath } from "../../util/paths";
import { getSystemPromptDotFile } from "../getSystemPromptDotFile";
import { PlatformConfigMetadata } from "../profile/PlatformProfileLoader";

import { slashFromCustomCommand } from "../../commands";
import { allTools } from "../../tools";
import { clientRenderHelper } from "./clientRender";
import { llmsFromModelConfig } from "./models";

async function loadConfigYaml(
  workspaceConfigs: string[],
  rawYaml: string,
  overrideConfigYaml: AssistantUnrolled | undefined,
  ide: IDE,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<AssistantUnrolled>> {
  let config =
    overrideConfigYaml ??
    (await clientRenderHelper(rawYaml, ide, controlPlaneClient));
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
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  allowFreeTrial: boolean = true,
): Promise<ContinueConfig> {
  const continueConfig: ContinueConfig = {
    slashCommands: [
      ...(await slashCommandsFromV1PromptFiles(ide)),
      ...(config.prompts?.map(slashFromCustomCommand) ?? []),
    ],
    models: [],
    tabAutocompleteModels: [],
    tools: allTools,
    systemMessage: config.rules?.join("\n"),
    embeddingsProvider: new TransformersJsEmbeddingsProvider(),
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
    data: config.data,
  };

  // Models
  for (const model of config.models ?? []) {
    if (
      ["chat", "summarize", "apply", "edit"].some((role: any) =>
        model.roles?.includes(role),
      )
    ) {
      // Main model array
      const llms = await llmsFromModelConfig(
        model,
        ide,
        uniqueId,
        ideSettings,
        writeLog,
        platformConfigMetadata,
        continueConfig.systemMessage,
      );
      continueConfig.models.push(...llms);
    }

    if (model.roles?.includes("autocomplete")) {
      // Autocomplete models array
      const llms = await llmsFromModelConfig(
        model,
        ide,
        uniqueId,
        ideSettings,
        writeLog,
        platformConfigMetadata,
        continueConfig.systemMessage,
      );
      continueConfig.tabAutocompleteModels?.push(...llms);
    }
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

  // TODO: Split into model roles.

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

  // Embeddings Provider
  const embedConfig = config.models?.find((model) =>
    model.roles?.includes("embed"),
  );
  if (embedConfig) {
    const { provider, ...options } = embedConfig;
    const embeddingsProviderClass = allEmbeddingsProviders[provider];
    if (embeddingsProviderClass) {
      if (
        embeddingsProviderClass.name === "_TransformersJsEmbeddingsProvider"
      ) {
        continueConfig.embeddingsProvider = new embeddingsProviderClass();
      } else {
        continueConfig.embeddingsProvider = new embeddingsProviderClass(
          options,
          (url: string | URL, init: any) =>
            fetchwithRequestOptions(url, init, {
              ...options.requestOptions,
            }),
        );
      }
    }
  }

  // Reranker
  const rerankConfig = config.models?.find((model) =>
    model.roles?.includes("rerank"),
  );
  if (rerankConfig) {
    const { provider, ...options } = rerankConfig;
    const rerankerClass = AllRerankers[provider];

    if (rerankerClass) {
      continueConfig.reranker = new rerankerClass(
        options,
        (url: string | URL, init: any) =>
          fetchwithRequestOptions(url, init, {
            ...options.requestOptions,
          }),
      );
    }
  }

  // Apply MCP if specified
  const mcpManager = MCPManagerSingleton.getInstance();
  config.mcpServers?.forEach(async (server) => {
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
      2000,
    );

    try {
      await mcpConnection.modifyConfig(
        continueConfig,
        mcpId,
        abortController.signal,
      );
    } catch (e: any) {
      if (e.name !== "AbortError") {
        throw e;
      }
    }
    clearTimeout(mcpConnectionTimeout);
  });

  return continueConfig;
}

export async function loadContinueConfigFromYaml(
  ide: IDE,
  workspaceConfigs: string[],
  ideSettings: IdeSettings,
  ideType: IdeType,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  overrideConfigYaml: AssistantUnrolled | undefined,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  controlPlaneClient: ControlPlaneClient,
): Promise<ConfigResult<ContinueConfig>> {
  const configYamlPath = getConfigYamlPath(ideType);
  const rawYaml =
    overrideConfigYaml === undefined
      ? fs.readFileSync(configYamlPath, "utf-8")
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

  const continueConfig = await configYamlToContinueConfig(
    configYamlResult.config,
    ide,
    ideSettings,
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

  return {
    config: continueConfig,
    errors: configYamlResult.errors,
    configLoadInterrupted: false,
  };
}

export { type BrowserSerializedContinueConfig };
