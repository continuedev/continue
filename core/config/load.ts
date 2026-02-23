import { execSync } from "child_process";
import * as fs from "fs";
import os from "os";
import path from "path";

import {
  ConfigResult,
  ConfigValidationError,
  mergeConfigYamlRequestOptions,
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
  InternalMcpOptions,
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
import CustomLLMClass from "../llm/llms/CustomLLM";
import { LLMReranker } from "../llm/llms/llm";
import TransformersJsEmbeddingsProvider from "../llm/llms/TransformersJsEmbeddingsProvider";
import { getAllPromptFiles } from "../promptFiles/getPromptFiles";
import { copyOf } from "../util";
import { GlobalContext } from "../util/GlobalContext";
import mergeJson from "../util/merge";
import {
  DEFAULT_CONFIG_TS_CONTENTS,
  getConfigJsonPath,
  getConfigJsonPathForRemote,
  getConfigJsPath,
  getConfigJsPathForRemote,
  getConfigTsPath,
  getContinueDotEnv,
  getEsbuildBinaryPath,
} from "../util/paths";
import { localPathToUri } from "../util/pathToUri";

import { loadJsonMcpConfigs } from "../context/mcp/json/loadJsonMcpConfigs";
import CustomContextProviderClass from "../context/providers/CustomContextProvider";
import { PolicySingleton } from "../control-plane/PolicySingleton";
import { getBaseToolDefinitions, serializeTool } from "../tools";
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
  ideType: IdeType,
  overrideConfigJson: SerializedContinueConfig | undefined,
  ide: IDE,
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

  if (os.platform() === "linux" && !isSupportedLanceDbCpuTargetForLinux(ide)) {
    config.disableIndexing = true;
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
      } else {
        const llm = new CustomLLMClass({
          ...desc,
          options: { ...desc.options, logger: llmLogger } as any,
        });
        if (llm.model === "AUTODETECT") {
          try {
            const modelNames = await llm.listModels();
            const models = modelNames.map(
              (modelName) =>
                new CustomLLMClass({
                  ...desc,
                  options: {
                    ...desc.options,
                    model: modelName,
                    logger: llmLogger,
                    isFromAutoDetect: true,
                  },
                }),
            );

            models.push(...models);
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
        } else {
          tabAutocompleteModels.push(new CustomLLMClass(desc));
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
      // config.ts-injected ILLM
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
    // config.ts-injected ILLM
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
      subagent: [],
    },
    selectedModelByRole: {
      chat: null, // Not implemented (uses GUI defaultModel)
      edit: null,
      apply: null,
      embed: newEmbedder ?? null,
      autocomplete: null,
      rerank: newReranker ?? null,
      summarize: null, // Not implemented
      subagent: null,
    },
    rules: [],
  };

  for (const cmd of config.slashCommands ?? []) {
    if ("source" in cmd) {
      continueConfig.slashCommands.push(cmd);
    } else {
      continueConfig.slashCommands.push({
        ...cmd,
        source: "config-ts-slash-command",
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
    const mcpOptions: InternalMcpOptions[] = (
      config.experimental?.modelContextProtocolServers ?? []
    ).map((server, index) => ({
      id: `continue-mcp-server-${index + 1}`,
      name: `MCP Server`,
      requestOptions: mergeConfigYamlRequestOptions(
        server.transport.type !== "stdio"
          ? server.transport.requestOptions
          : undefined,
        config.requestOptions,
      ),
      ...server.transport,
    }));
    const { errors: jsonMcpErrors, mcpServers } = await loadJsonMcpConfigs(
      ide,
      true,
      config.requestOptions,
    );
    errors.push(...jsonMcpErrors);
    mcpOptions.push(...mcpServers);
    mcpManager.setConnections(mcpOptions, false);
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
    tools: final.tools.map(serializeTool),
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

function escapeSpacesInPath(p: string): string {
  return p.replace(/ /g, "\\ ");
}

async function handleEsbuildInstallation(
  ide: IDE,
  _ideType: IdeType,
): Promise<boolean> {
  // Only check when config.ts is going to be used; never auto-install.
  const installCmd = "npm i esbuild@x.x.x --prefix ~/.continue";

  // Try to detect a user-installed esbuild (normal resolution)
  try {
    await import("esbuild");
    return true; // available
  } catch {
    // Try resolving from ~/.continue/node_modules as a courtesy
    try {
      const userEsbuild = path.join(
        os.homedir(),
        ".continue",
        "node_modules",
        "esbuild",
      );
      const candidate = require.resolve("esbuild", { paths: [userEsbuild] });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(candidate);
      return true; // available via ~/.continue
    } catch {
      // Not available → show friendly instructions and opt out of building
      await ide.showToast(
        "error",
        [
          "config.ts has been deprecated and esbuild is no longer automatically installed by Continue.",
          "To use config.ts, install esbuild manually:",
          "",
          `    ${installCmd}`,
        ].join("\n"),
      );
      return false;
    }
  }
}

async function tryBuildConfigTs() {
  try {
    if (process.env.IS_BINARY === "true") {
      await buildConfigTsWithBinary();
    } else {
      await buildConfigTsWithNodeModule();
    }
  } catch (e) {
    console.log(
      `Build error. Please check your ~/.continue/config.ts file: ${e}`,
    );
  }
}

async function buildConfigTsWithBinary() {
  const cmd = [
    escapeSpacesInPath(getEsbuildBinaryPath()),
    escapeSpacesInPath(getConfigTsPath()),
    "--bundle",
    `--outfile=${escapeSpacesInPath(getConfigJsPath())}`,
    "--platform=node",
    "--format=cjs",
    "--sourcemap",
    "--external:fetch",
    "--external:fs",
    "--external:path",
    "--external:os",
    "--external:child_process",
  ].join(" ");

  execSync(cmd);
}

async function buildConfigTsWithNodeModule() {
  const { build } = await import("esbuild");

  await build({
    entryPoints: [getConfigTsPath()],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: getConfigJsPath(),
    external: ["fetch", "fs", "path", "os", "child_process"],
    sourcemap: true,
  });
}

function readConfigJs(): string | undefined {
  const configJsPath = getConfigJsPath();

  if (!fs.existsSync(configJsPath)) {
    return undefined;
  }

  return fs.readFileSync(configJsPath, "utf8");
}

async function buildConfigTsandReadConfigJs(ide: IDE, ideType: IdeType) {
  const configTsPath = getConfigTsPath();

  if (!fs.existsSync(configTsPath)) {
    return;
  }

  const currentContent = fs.readFileSync(configTsPath, "utf8");

  // If the user hasn't modified the default config.ts, don't bother building
  if (currentContent.trim() === DEFAULT_CONFIG_TS_CONTENTS.trim()) {
    return;
  }

  // Only bother with esbuild if config.ts is actually customized
  if (currentContent.trim() !== DEFAULT_CONFIG_TS_CONTENTS.trim()) {
    const ok = await handleEsbuildInstallation(ide, ideType);
    if (!ok) {
      // esbuild not available → we already showed a friendly message; skip building
      return;
    }
    await tryBuildConfigTs();
  }

  return readConfigJs();
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
  // TODO: override several of these values with user/org shared config
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(serialized, sharedConfig);

  // Convert serialized to intermediate config
  let intermediate = await serializedToIntermediateConfig(withShared, ide);

  // Apply config.ts to modify intermediate config
  const configJsContents = await buildConfigTsandReadConfigJs(
    ide,
    ideInfo.ideType,
  );
  if (configJsContents) {
    try {
      // Try config.ts first
      const configJsPath = getConfigJsPath();
      let module: any;

      try {
        module = await import(configJsPath);
      } catch (e) {
        console.log(e);
        console.log(
          "Could not load config.ts as absolute path, retrying as file url ...",
        );
        try {
          module = await import(localPathToUri(configJsPath));
        } catch (e) {
          throw new Error("Could not load config.ts as file url either", {
            cause: e,
          });
        }
      }

      if (typeof require !== "undefined") {
        delete require.cache[require.resolve(configJsPath)];
      }
      if (!module.modifyConfig) {
        throw new Error("config.ts does not export a modifyConfig function.");
      }
      intermediate = module.modifyConfig(intermediate);
    } catch (e) {
      console.log("Error loading config.ts: ", e);
    }
  }

  // Apply remote config.js to modify intermediate config
  if (ideSettings.remoteConfigServerUrl) {
    try {
      const configJsPathForRemote = getConfigJsPathForRemote(
        ideSettings.remoteConfigServerUrl,
      );
      const module = await import(configJsPathForRemote);
      if (typeof require !== "undefined") {
        delete require.cache[require.resolve(configJsPathForRemote)];
      }
      if (!module.modifyConfig) {
        throw new Error("config.ts does not export a modifyConfig function.");
      }
      intermediate = module.modifyConfig(intermediate);
    } catch (e) {
      console.log("Error loading remotely set config.js: ", e);
    }
  }

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
