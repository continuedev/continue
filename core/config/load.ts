import * as fs from "fs";
import os from "os";

import {
  ConfigResult,
  ConfigValidationError,
  ModelRole,
} from "@continuedev/config-yaml";
import * as JSONC from "comment-json";

import {
  BrowserSerializedContinueConfig,
  Config,
  ContextProviderWithParams,
  ContinueConfig,
  ContinueRcJson,
  CustomContextProvider,
  EmbeddingsProviderDescription,
  IDE,
  IdeInfo,
  IdeSettings,
  IdeType,
  ILLM,
  ILLMLogger,
  LLMOptions,
  ModelDescription,
  RerankerDescription,
  SerializedContinueConfig,
  SlashCommandWithSource,
} from "..";
import { getLegacyBuiltInSlashCommandFromDescription } from "../commands/slash/built-in-legacy";
import { convertCustomCommandToSlashCommand } from "../commands/slash/customSlashCommand";
import { slashCommandFromPromptFile } from "../commands/slash/promptFileSlashCommand";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";
import { useHub } from "../control-plane/env";
import { BaseLLM } from "../llm";
import { LLMClasses, llmFromDescription } from "../llm/llms";
import { LLMReranker } from "../llm/llms/llm";
import TransformersJsEmbeddingsProvider from "../llm/llms/TransformersJsEmbeddingsProvider";
import { getAllPromptFiles } from "../promptFiles/getPromptFiles";
import { copyOf } from "../util";
import { GlobalContext } from "../util/GlobalContext";
import mergeJson from "../util/merge";
import {
  getConfigJsonPath,
  getConfigJsonPathForRemote,
  getConfigTsPath,
  getContinueDotEnv,
} from "../util/paths";

import CustomContextProviderClass from "../context/providers/CustomContextProvider";
import { PolicySingleton } from "../control-plane/PolicySingleton";
import { getBaseToolDefinitions } from "../tools";
import { resolveRelativePathInDir } from "../util/ideUtils";
import { getWorkspaceRcConfigs } from "./json/loadRcConfigs";
import { loadConfigContextProviders } from "./loadContextProviders";
import { modifyAnyConfigWithSharedConfig } from "./sharedConfig";
import {
  getModelByRole,
  isSupportedLanceDbCpuTargetForLinux,
  serializePromptTemplates,
} from "./util";
import { validateConfig } from "./validation.js";

export function resolveSerializedConfig(
  filepath: string,
): SerializedContinueConfig {
  let content = fs.readFileSync(filepath, "utf8");
  const config = JSONC.parse(content) as unknown as SerializedContinueConfig;
  if (config.env && Array.isArray(config.env)) {
    const env = {
      ...process.env,
      ...getContinueDotEnv(),
    };

    config.env.forEach((envVar) => {
      if (envVar in env) {
        content = (content as any).replaceAll(
          new RegExp(`"${envVar}"`, "g"),
          `"${env[envVar]}"`,
        );
      }
    });
  }

  return JSONC.parse(content) as unknown as SerializedContinueConfig;
}

const configMergeKeys = {
  models: (a: any, b: any) => a.title === b.title,
  contextProviders: (a: any, b: any) => {
    // If not HTTP providers, use the name only
    if (a.name !== "http" || b.name !== "http") {
      return a.name === b.name;
    }
    // For HTTP providers, consider them different if they have different URLs
    return a.name === b.name && a.params?.url === b.params?.url;
  },
  slashCommands: (a: any, b: any) => a.name === b.name,
  customCommands: (a: any, b: any) => a.name === b.name,
};

function loadSerializedConfig(
  workspaceConfigs: ContinueRcJson[],
  ideSettings: IdeSettings,
  _ideType: IdeType, // kept for signature stability; unused
  overrideConfigJson: SerializedContinueConfig | undefined,
  _ide: IDE, // kept for signature stability; unused
): ConfigResult<SerializedContinueConfig> {
  let config: SerializedContinueConfig = overrideConfigJson!;
  if (!config) {
    try {
      config = resolveSerializedConfig(getConfigJsonPath());
    } catch (e) {
      throw new Error(`Failed to parse config.json: ${e}`);
    }
  }

  const errors = validateConfig(config);

  if (errors?.some((error) => error.fatal)) {
    return {
      errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  if (config.allowAnonymousTelemetry === undefined) {
    config.allowAnonymousTelemetry = true;
  }

  if (ideSettings.remoteConfigServerUrl) {
    try {
      const remoteConfigJson = resolveSerializedConfig(
        getConfigJsonPathForRemote(ideSettings.remoteConfigServerUrl),
      );
      config = mergeJson(config, remoteConfigJson, "merge", configMergeKeys);
    } catch (e) {
      console.warn("Error loading remote config: ", e);
    }
  }

  for (const workspaceConfig of workspaceConfigs) {
    config = mergeJson(
      config,
      workspaceConfig,
      workspaceConfig.mergeBehavior,
      configMergeKeys,
    );
  }

  // Linux CPU target compatibility guard for indexing
  if (os.platform() === "linux") {
    // `isSupportedLanceDbCpuTargetForLinux` checks IDE env for known incompatibilities
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ide: any = _ide;
    if (!isSupportedLanceDbCpuTargetForLinux(ide)) {
      config.disableIndexing = true;
    }
  }

  return { config, errors, configLoadInterrupted: false };
}

async function serializedToIntermediateConfig(
  initial: SerializedContinueConfig,
  ide: IDE,
): Promise<Config> {
  // DEPRECATED - load custom slash commands
  const slashCommands: SlashCommandWithSource[] = [];
  for (const command of initial.slashCommands || []) {
    const newCommand = getLegacyBuiltInSlashCommandFromDescription(command);
    if (newCommand) {
      slashCommands.push(newCommand);
    }
  }
  for (const command of initial.customCommands || []) {
    slashCommands.push(convertCustomCommandToSlashCommand(command));
  }

  // DEPRECATED - load slash commands from v1 prompt files
  // NOTE: still checking the v1 default .prompts folder for slash commands
  const promptFiles = await getAllPromptFiles(
    ide,
    initial.experimental?.promptPath,
    true,
  );

  for (const file of promptFiles) {
    const slashCommand = slashCommandFromPromptFile(file.path, file.content);
    if (slashCommand) {
      slashCommands.push(slashCommand);
    }
  }

  const config: Config = {
    ...initial,
    slashCommands,
    contextProviders: initial.contextProviders || [],
  };

  return config;
}

// Merge request options set for entire config with model specific options
function applyRequestOptionsToModels(
  models: BaseLLM[],
  config: Config,
  roles: ModelRole[] | undefined = undefined,
) {
  // Prepare models
  for (const model of models) {
    model.requestOptions = {
      ...config.requestOptions,
      ...model.requestOptions,
    };
    if (roles !== undefined) {
      model.roles = model.roles ?? roles;
    }
  }
}

export function isContextProviderWithParams(
  contextProvider: CustomContextProvider | ContextProviderWithParams,
): contextProvider is ContextProviderWithParams {
  return "name" in contextProvider && !!contextProvider.name;
}

/** Only difference between intermediate and final configs is the `models` array */
async function intermediateToFinalConfig({
  config,
  ide,
  ideSettings,
  ideInfo,
  uniqueId,
  llmLogger,
  workOsAccessToken,
  loadPromptFiles = true,
}: {
  config: Config;
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
  loadPromptFiles?: boolean;
}): Promise<{ config: ContinueConfig; errors: ConfigValidationError[] }> {
  const errors: ConfigValidationError[] = [];
  const workspaceDirs = await ide.getWorkspaceDirs();
  const getUriFromPath = (path: string) => {
    return resolveRelativePathInDir(path, ide, workspaceDirs);
  };
  // Auto-detect models
  let models: BaseLLM[] = [];
  await Promise.all(
    config.models.map(async (desc) => {
      if ("title" in desc) {
        const llm = await llmFromDescription(
          desc,
          ide.readFile.bind(ide),
          getUriFromPath,
          uniqueId,
          ideSettings,
          llmLogger,
          config.completionOptions,
        );
        if (!llm) {
          return;
        }

        if (llm.model === "AUTODETECT") {
          try {
            const modelNames = await llm.listModels();
            const detectedModels = await Promise.all(
              modelNames.map(async (modelName) => {
                return await llmFromDescription(
                  {
                    ...desc,
                    model: modelName,
                    title: modelName,
                    isFromAutoDetect: true,
                  },
                  ide.readFile.bind(ide),
                  getUriFromPath,
                  uniqueId,
                  ideSettings,
                  llmLogger,
                  copyOf(config.completionOptions),
                );
              }),
            );
            models.push(
              ...(detectedModels.filter(
                (x) => typeof x !== "undefined",
              ) as BaseLLM[]),
            );
          } catch (e) {
            console.warn("Error listing models: ", e);
          }
        } else {
          models.push(llm);
        }
      }
    }),
  );

  applyRequestOptionsToModels(models, config, [
    "chat",
    "apply",
    "edit",
    "summarize",
  ]); // Default to chat role if not specified

  // Free trial provider will be completely ignored
  let warnAboutFreeTrial = false;
  models = models.filter((model) => model.providerName !== "free-trial");
  if (models.filter((m) => m.providerName === "free-trial").length) {
    warnAboutFreeTrial = true;
  }

  // Tab autocomplete model
  const tabAutocompleteModels: BaseLLM[] = [];
  if (config.tabAutocompleteModel) {
    const autocompleteConfigs = Array.isArray(config.tabAutocompleteModel)
      ? config.tabAutocompleteModel
      : [config.tabAutocompleteModel];

    await Promise.all(
      autocompleteConfigs.map(async (desc) => {
        if ("title" in desc) {
          const llm = await llmFromDescription(
            desc,
            ide.readFile.bind(ide),
            getUriFromPath,
            uniqueId,
            ideSettings,
            llmLogger,
            config.completionOptions,
          );
          if (llm) {
            if (llm.providerName === "free-trial") {
              warnAboutFreeTrial = true;
            } else {
              tabAutocompleteModels.push(llm);
            }
          }
        }
      }),
    );
  }

  applyRequestOptionsToModels(tabAutocompleteModels, config);

  // Load context providers
  const { providers: contextProviders, errors: contextErrors } =
    loadConfigContextProviders(
      config.contextProviders
        ?.filter((cp) => isContextProviderWithParams(cp))
        .map((cp) => ({
          provider: (cp as ContextProviderWithParams).name,
          params: (cp as ContextProviderWithParams).params,
        })),
      !!config.docs?.length,
      ideInfo.ideType,
    );

  for (const cp of config.contextProviders ?? []) {
    if (!isContextProviderWithParams(cp)) {
      contextProviders.push(new CustomContextProviderClass(cp));
    }
  }
  errors.push(...contextErrors);

  // Embeddings Provider
  function getEmbeddingsILLM(
    embedConfig: EmbeddingsProviderDescription | ILLM | undefined,
  ): ILLM | null {
    if (embedConfig) {
      // If user provided an ILLM instance directly (e.g., via YAML injection), pass through
      if ("providerName" in embedConfig) {
        return embedConfig;
      }
      const { provider, ...options } = embedConfig;
      if (provider === "transformers.js" || provider === "free-trial") {
        if (provider === "free-trial") {
          warnAboutFreeTrial = true;
        }
        return new TransformersJsEmbeddingsProvider();
      } else {
        const cls = LLMClasses.find((c) => c.providerName === provider);
        if (cls) {
          const llmOptions: LLMOptions = {
            model: options.model ?? "UNSPECIFIED",
            ...options,
          };
          return new cls(llmOptions);
        } else {
          errors.push({
            fatal: false,
            message: `Embeddings provider ${provider} not found`,
          });
        }
      }
    }
    if (ideInfo.ideType === "vscode") {
      return new TransformersJsEmbeddingsProvider();
    }
    return null;
  }
  const newEmbedder = getEmbeddingsILLM(config.embeddingsProvider);

  // Reranker
  function getRerankingILLM(
    rerankingConfig: ILLM | RerankerDescription | undefined,
  ): ILLM | null {
    if (!rerankingConfig) {
      return null;
    }
    if ("providerName" in rerankingConfig) {
      return rerankingConfig;
    }
    const { name, params } = config.reranker as RerankerDescription;
    if (name === "free-trial") {
      warnAboutFreeTrial = true;
      return null;
    }
    if (name === "llm") {
      const llm = models.find((model) => model.title === params?.modelTitle);
      if (!llm) {
        errors.push({
          fatal: false,
          message: `Unknown reranking model ${params?.modelTitle}`,
        });
        return null;
      } else {
        return new LLMReranker(llm);
      }
    } else {
      const cls = LLMClasses.find((c) => c.providerName === name);
      if (cls) {
        const llmOptions: LLMOptions = {
          model: params?.model ?? "UNSPECIFIED",
          ...params,
        };
        return new cls(llmOptions);
      } else {
        errors.push({
          fatal: false,
          message: `Unknown reranking provider ${name}`,
        });
      }
    }
    return null;
  }
  const newReranker = getRerankingILLM(config.reranker);

  if (warnAboutFreeTrial) {
    errors.push({
      fatal: false,
      message:
        "Model provider 'free-trial' is no longer supported, will be ignored",
    });
  }

  const continueConfig: ContinueConfig = {
    ...config,
    contextProviders,
    tools: getBaseToolDefinitions(),
    mcpServerStatuses: [],
    slashCommands: [],
    modelsByRole: {
      chat: models,
      edit: models,
      apply: models,
      summarize: models,
      autocomplete: [...tabAutocompleteModels],
      embed: newEmbedder ? [newEmbedder] : [],
      rerank: newReranker ? [newReranker] : [],
    },
    selectedModelByRole: {
      chat: null, // Not implemented (uses GUI defaultModel)
      edit: null,
      apply: null,
      embed: newEmbedder ?? null,
      autocomplete: null,
      rerank: newReranker ?? null,
      summarize: null, // Not implemented
    },
    rules: [],
  };

  for (const cmd of config.slashCommands ?? []) {
    if ("source" in cmd) {
      continueConfig.slashCommands.push(cmd);
    } else {
      continueConfig.slashCommands.push({
        ...cmd,
        source: "json-custom-command",
      });
    }
  }

  if (config.systemMessage) {
    continueConfig.rules.unshift({
      rule: config.systemMessage,
      source: "json-systemMessage",
    });
  }

  // Trigger MCP server refreshes (Config is reloaded again once connected!)
  const mcpManager = MCPManagerSingleton.getInstance();

  const orgPolicy = PolicySingleton.getInstance().policy;
  if (orgPolicy?.policy?.allowMcpServers === false) {
    await mcpManager.shutdown();
  } else {
    mcpManager.setConnections(
      (config.experimental?.modelContextProtocolServers ?? []).map(
        (server, index) => ({
          id: `continue-mcp-server-${index + 1}`,
          name: `MCP Server`,
          ...server,
          requestOptions: config.requestOptions,
        }),
      ),
      false,
    );
  }

  // Handle experimental modelRole config values for apply and edit
  const inlineEditModel = getModelByRole(continueConfig, "inlineEdit")?.title;
  if (inlineEditModel) {
    const match = continueConfig.modelsByRole.chat.find(
      (m) => m.title === inlineEditModel,
    );
    if (match) {
      continueConfig.selectedModelByRole.edit = match;
      continueConfig.modelsByRole.edit = [match]; // The only option if inlineEdit role is set
    } else {
      errors.push({
        fatal: false,
        message: `experimental.modelRoles.inlineEdit model title ${inlineEditModel} not found in models array`,
      });
    }
  }

  const applyBlockModel = getModelByRole(
    continueConfig,
    "applyCodeBlock",
  )?.title;
  if (applyBlockModel) {
    const match = continueConfig.modelsByRole.chat.find(
      (m) => m.title === applyBlockModel,
    );
    if (match) {
      continueConfig.selectedModelByRole.apply = match;
      continueConfig.modelsByRole.apply = [match]; // The only option if applyCodeBlock role is set
    } else {
      errors.push({
        fatal: false,
        message: `experimental.modelRoles.applyCodeBlock model title ${inlineEditModel} not found in models array`,
      });
    }
  }

  // Add transformers JS to the embed models list if not already added
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

  return { config: continueConfig, errors };
}

function llmToSerializedModelDescription(llm: ILLM): ModelDescription {
  return {
    provider: llm.providerName,
    underlyingProviderName: llm.underlyingProviderName,
    model: llm.model,
    title: llm.title ?? llm.model,
    apiKey: llm.apiKey,
    apiBase: llm.apiBase,
    contextLength: llm.contextLength,
    template: llm.template,
    completionOptions: llm.completionOptions,
    baseAgentSystemMessage: llm.baseAgentSystemMessage,
    basePlanSystemMessage: llm.basePlanSystemMessage,
    baseChatSystemMessage: llm.baseChatSystemMessage,
    requestOptions: llm.requestOptions,
    promptTemplates: serializePromptTemplates(llm.promptTemplates),
    capabilities: llm.capabilities,
    roles: llm.roles,
    configurationStatus: llm.getConfigurationStatus(),
    apiKeyLocation: llm.apiKeyLocation,
    envSecretLocations: llm.envSecretLocations,
    sourceFile: llm.sourceFile,
    isFromAutoDetect: llm.isFromAutoDetect,
  };
}

async function finalToBrowserConfig(
  final: ContinueConfig,
  ide: IDE,
): Promise<BrowserSerializedContinueConfig> {
  return {
    allowAnonymousTelemetry: final.allowAnonymousTelemetry,
    completionOptions: final.completionOptions,
    slashCommands: final.slashCommands?.map(({ run, ...rest }) => ({
      ...rest,
      isLegacy: !!run,
    })),
    contextProviders: final.contextProviders?.map((c) => c.description),
    disableIndexing: final.disableIndexing,
    disableSessionTitles: final.disableSessionTitles,
    userToken: final.userToken,
    ui: final.ui,
    experimental: final.experimental,
    rules: final.rules,
    docs: final.docs,
    tools: final.tools,
    mcpServerStatuses: final.mcpServerStatuses,
    tabAutocompleteOptions: final.tabAutocompleteOptions,
    usePlatform: await useHub(ide.getIdeSettings()),
    modelsByRole: Object.fromEntries(
      Object.entries(final.modelsByRole).map(([k, v]) => [
        k,
        v.map(llmToSerializedModelDescription),
      ]),
    ) as Record<ModelRole, ModelDescription[]>, // TODO better types here
    selectedModelByRole: Object.fromEntries(
      Object.entries(final.selectedModelByRole).map(([k, v]) => [
        k,
        v ? llmToSerializedModelDescription(v) : null,
      ]),
    ) as Record<ModelRole, ModelDescription | null>, // TODO better types here
    // data not included here because client doesn't need
  };
}

async function loadContinueConfigFromJson(
  ide: IDE,
  ideSettings: IdeSettings,
  ideInfo: IdeInfo,
  uniqueId: string,
  llmLogger: ILLMLogger,
  workOsAccessToken: string | undefined,
  overrideConfigJson: SerializedContinueConfig | undefined,
): Promise<ConfigResult<ContinueConfig>> {
  // Fail fast if a legacy config.ts exists
  try {
    const tsPath = getConfigTsPath();
    if (fs.existsSync(tsPath)) {
      return {
        errors: [
          {
            fatal: true,
            message:
              "Detected legacy '~/.continue/config.ts'. TypeScript configs are no longer supported. Please migrate your settings to 'config.json' / 'config.yaml'.",
          },
        ],
        config: undefined,
        configLoadInterrupted: true,
      };
    }
  } catch {
    // ignore path resolution errors; proceed with normal load
  }

  const workspaceConfigs = await getWorkspaceRcConfigs(ide);

  // Serialized config
  let {
    config: serialized,
    errors,
    configLoadInterrupted,
  } = loadSerializedConfig(
    workspaceConfigs,
    ideSettings,
    ideInfo.ideType,
    overrideConfigJson,
    ide,
  );

  if (!serialized || configLoadInterrupted) {
    return { errors, config: undefined, configLoadInterrupted: true };
  }

  // Apply shared config
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(serialized, sharedConfig);

  // Convert serialized to intermediate config
  const intermediate = await serializedToIntermediateConfig(withShared, ide);

  // NOTE: Previously, a TS/JS mutator could tweak the intermediate config; that is now removed.

  // Convert to final config format
  const { config: finalConfig, errors: finalErrors } =
    await intermediateToFinalConfig({
      config: intermediate,
      ide,
      ideSettings,
      ideInfo,
      uniqueId,
      llmLogger,
      workOsAccessToken,
    });

  return {
    config: finalConfig,
    errors: [...(errors ?? []), ...finalErrors],
    configLoadInterrupted: false,
  };
}

export {
  finalToBrowserConfig,
  loadContinueConfigFromJson,
  type BrowserSerializedContinueConfig,
};
