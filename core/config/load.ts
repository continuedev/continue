import * as JSONC from "comment-json";
import * as fs from "fs";
import path from "path";
import * as tar from "tar";
import {
  slashCommandFromDescription,
  slashFromCustomCommand,
} from "../commands/index.js";
import CustomContextProviderClass from "../context/providers/CustomContextProvider";
import FileContextProvider from "../context/providers/FileContextProvider";
import { contextProviderClassFromName } from "../context/providers/index";
import { AllRerankers } from "../context/rerankers/index";
import { LLMReranker } from "../context/rerankers/llm";
import {
  BrowserSerializedContinueConfig,
  Config,
  ContextProviderWithParams,
  ContinueConfig,
  ContinueRcJson,
  CustomContextProvider,
  CustomLLM,
  EmbeddingsProviderDescription,
  IContextProvider,
  IDE,
  IdeSettings,
  IdeType,
  ModelDescription,
  Reranker,
  RerankerDescription,
  SerializedContinueConfig,
  SlashCommand,
} from "..";
import TransformersJsEmbeddingsProvider from "../indexing/embeddings/TransformersJsEmbeddingsProvider";
import { allEmbeddingsProviders } from "../indexing/embeddings";
import { BaseLLM } from "../llm";
import CustomLLMClass from "../llm/llms/CustomLLM";
import FreeTrial from "../llm/llms/FreeTrial";
import { llmFromDescription } from "../llm/llms";
import os from "os";
import { execSync } from "child_process";
import CodebaseContextProvider from "../context/providers/CodebaseContextProvider";
import ContinueProxyContextProvider from "../context/providers/ContinueProxyContextProvider";
import { fetchwithRequestOptions } from "../util/fetchWithOptions";
import { copyOf } from "../util";
import mergeJson from "../util/merge";
import {
  DEFAULT_CONFIG_TS_CONTENTS,
  getConfigJsPath,
  getConfigJsPathForRemote,
  getConfigJsonPath,
  getConfigJsonPathForRemote,
  getConfigTsPath,
  getContinueDotEnv,
  getEsbuildBinaryPath,
  readAllGlobalPromptFiles,
} from "../util/paths";
import {
  defaultContextProvidersJetBrains,
  defaultContextProvidersVsCode,
  defaultSlashCommandsJetBrains,
  defaultSlashCommandsVscode,
} from "./default";
import {
  DEFAULT_PROMPTS_FOLDER,
  getPromptFiles,
  slashCommandFromPromptFile,
} from "./promptFile.js";
import { validateConfig, ConfigValidationError } from "./validation.js";

import { GlobalContext } from "../util/GlobalContext";

export interface ConfigResult<T> {
  config: T | undefined;
  errors: ConfigValidationError[] | undefined;
  configLoadInterrupted: boolean;
}

function resolveSerializedConfig(filepath: string): SerializedContinueConfig {
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
  contextProviders: (a: any, b: any) => a.name === b.name,
  slashCommands: (a: any, b: any) => a.name === b.name,
  customCommands: (a: any, b: any) => a.name === b.name,
};

function loadSerializedConfig(
  workspaceConfigs: ContinueRcJson[],
  ideSettings: IdeSettings,
  ideType: IdeType,
  overrideConfigJson: SerializedContinueConfig | undefined,
): ConfigResult<SerializedContinueConfig> {
  const configPath = getConfigJsonPath(ideType);
  let config: SerializedContinueConfig = overrideConfigJson!;
  if (!config) {
    try {
      config = resolveSerializedConfig(configPath);
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

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  config.contextProviders ??=
    ideType === "vscode"
      ? [...defaultContextProvidersVsCode]
      : [...defaultContextProvidersJetBrains];
  config.slashCommands ??=
    ideType === "vscode"
      ? [...defaultSlashCommandsVscode]
      : [...defaultSlashCommandsJetBrains];

  return { config, errors, configLoadInterrupted: false };
}

async function serializedToIntermediateConfig(
  initial: SerializedContinueConfig,
  ide: IDE,
  loadPromptFiles: boolean = true,
): Promise<Config> {
  const slashCommands: SlashCommand[] = [];
  for (const command of initial.slashCommands || []) {
    const newCommand = slashCommandFromDescription(command);
    if (newCommand) {
      slashCommands.push(newCommand);
    }
  }
  for (const command of initial.customCommands || []) {
    slashCommands.push(slashFromCustomCommand(command));
  }

  const workspaceDirs = await ide.getWorkspaceDirs();
  const promptFolder = initial.experimental?.promptPath;

  if (loadPromptFiles) {
    let promptFiles: { path: string; content: string }[] = [];
    promptFiles = (
      await Promise.all(
        workspaceDirs.map((dir) =>
          getPromptFiles(
            ide,
            path.join(dir, promptFolder ?? DEFAULT_PROMPTS_FOLDER),
          ),
        ),
      )
    )
      .flat()
      .filter(({ path }) => path.endsWith(".prompt"));

    // Also read from ~/.continue/.prompts
    promptFiles.push(...readAllGlobalPromptFiles());

    for (const file of promptFiles) {
      slashCommands.push(slashCommandFromPromptFile(file.path, file.content));
    }
  }

  const config: Config = {
    ...initial,
    slashCommands,
    contextProviders: initial.contextProviders || [],
  };

  return config;
}

function isModelDescription(
  llm: ModelDescription | CustomLLM,
): llm is ModelDescription {
  return (llm as ModelDescription).title !== undefined;
}

function isContextProviderWithParams(
  contextProvider: CustomContextProvider | ContextProviderWithParams,
): contextProvider is ContextProviderWithParams {
  return (contextProvider as ContextProviderWithParams).name !== undefined;
}

/** Only difference between intermediate and final configs is the `models` array */
async function intermediateToFinalConfig(
  config: Config,
  ide: IDE,
  ideSettings: IdeSettings,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  allowFreeTrial: boolean = true,
): Promise<ContinueConfig> {
  // Auto-detect models
  let models: BaseLLM[] = [];
  for (const desc of config.models) {
    if (isModelDescription(desc)) {
      const llm = await llmFromDescription(
        desc,
        ide.readFile.bind(ide),
        uniqueId,
        ideSettings,
        writeLog,
        config.completionOptions,
        config.systemMessage,
      );
      if (!llm) {
        continue;
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
                  title: `${llm.title} - ${modelName}`,
                },
                ide.readFile.bind(ide),
                uniqueId,
                ideSettings,
                writeLog,
                copyOf(config.completionOptions),
                config.systemMessage,
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
        options: { ...desc.options, writeLog } as any,
      });
      if (llm.model === "AUTODETECT") {
        try {
          const modelNames = await llm.listModels();
          const models = modelNames.map(
            (modelName) =>
              new CustomLLMClass({
                ...desc,
                options: { ...desc.options, model: modelName, writeLog },
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
  }

  // Prepare models
  for (const model of models) {
    model.requestOptions = {
      ...model.requestOptions,
      ...config.requestOptions,
    };
  }

  if (allowFreeTrial) {
    // Obtain auth token (iff free trial being used)
    const freeTrialModels = models.filter(
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
    models = models.filter((model) => model.providerName !== "free-trial");
  }

  // Tab autocomplete model
  let tabAutocompleteModels: BaseLLM[] = [];
  if (config.tabAutocompleteModel) {
    tabAutocompleteModels = (
      await Promise.all(
        (Array.isArray(config.tabAutocompleteModel)
          ? config.tabAutocompleteModel
          : [config.tabAutocompleteModel]
        ).map(async (desc) => {
          if (isModelDescription(desc)) {
            const llm = await llmFromDescription(
              desc,
              ide.readFile.bind(ide),
              uniqueId,
              ideSettings,
              writeLog,
              config.completionOptions,
              config.systemMessage,
            );

            if (llm?.providerName === "free-trial") {
              if (!allowFreeTrial) {
                // This shouldn't happen
                throw new Error("Free trial cannot be used with control plane");
              }
              const ghAuthToken = await ide.getGitHubAuthToken({});
              (llm as FreeTrial).setupGhAuthToken(ghAuthToken);
            }
            return llm;
          } else {
            return new CustomLLMClass(desc);
          }
        }),
      )
    ).filter((x) => x !== undefined) as BaseLLM[];
  }

  // These context providers are always included, regardless of what, if anything,
  // the user has configured in config.json

  const codebaseContextParams =
    (
      (config.contextProviders || [])
        .filter(isContextProviderWithParams)
        .find((cp) => cp.name === "codebase") as
        | ContextProviderWithParams
        | undefined
    )?.params || {};
  const DEFAULT_CONTEXT_PROVIDERS = [
    new FileContextProvider({}),
    new CodebaseContextProvider(codebaseContextParams),
  ];

  const DEFAULT_CONTEXT_PROVIDERS_TITLES = DEFAULT_CONTEXT_PROVIDERS.map(
    ({ description: { title } }) => title,
  );

  // Context providers
  const contextProviders: IContextProvider[] = DEFAULT_CONTEXT_PROVIDERS;

  for (const provider of config.contextProviders || []) {
    if (isContextProviderWithParams(provider)) {
      const cls = contextProviderClassFromName(provider.name) as any;
      if (!cls) {
        if (!DEFAULT_CONTEXT_PROVIDERS_TITLES.includes(provider.name)) {
          console.warn(`Unknown context provider ${provider.name}`);
        }

        continue;
      }
      const instance: IContextProvider = new cls(provider.params);

      // Handle continue-proxy
      if (instance.description.title === "continue-proxy") {
        (instance as ContinueProxyContextProvider).workOsAccessToken =
          workOsAccessToken;
      }

      contextProviders.push(instance);
    } else {
      contextProviders.push(new CustomContextProviderClass(provider));
    }
  }

  // Embeddings Provider
  const embeddingsProviderDescription = config.embeddingsProvider as
    | EmbeddingsProviderDescription
    | undefined;
  if (embeddingsProviderDescription?.provider) {
    const { provider, ...options } = embeddingsProviderDescription;
    const embeddingsProviderClass = allEmbeddingsProviders[provider];
    if (embeddingsProviderClass) {
      if (
        embeddingsProviderClass.name === "_TransformersJsEmbeddingsProvider"
      ) {
        config.embeddingsProvider = new embeddingsProviderClass();
      } else {
        config.embeddingsProvider = new embeddingsProviderClass(
          options,
          (url: string | URL, init: any) =>
            fetchwithRequestOptions(url, init, {
              ...config.requestOptions,
              ...options.requestOptions,
            }),
        );
      }
    }
  }

  if (!config.embeddingsProvider) {
    config.embeddingsProvider = new TransformersJsEmbeddingsProvider();
  }

  // Reranker
  if (config.reranker && !(config.reranker as Reranker | undefined)?.rerank) {
    const { name, params } = config.reranker as RerankerDescription;
    const rerankerClass = AllRerankers[name];

    if (name === "llm") {
      const llm = models.find((model) => model.title === params?.modelTitle);
      if (!llm) {
        console.warn(`Unknown model ${params?.modelTitle}`);
      } else {
        config.reranker = new LLMReranker(llm);
      }
    } else if (rerankerClass) {
      config.reranker = new rerankerClass(params);
    }
  }

  return {
    ...config,
    contextProviders,
    models,
    embeddingsProvider: config.embeddingsProvider as any,
    tabAutocompleteModels,
    reranker: config.reranker as any,
  };
}

function finalToBrowserConfig(
  final: ContinueConfig,
): BrowserSerializedContinueConfig {
  return {
    allowAnonymousTelemetry: final.allowAnonymousTelemetry,
    models: final.models.map((m) => ({
      provider: m.providerName,
      model: m.model,
      title: m.title ?? m.model,
      apiKey: m.apiKey,
      apiBase: m.apiBase,
      contextLength: m.contextLength,
      template: m.template,
      completionOptions: m.completionOptions,
      systemMessage: m.systemMessage,
      requestOptions: m.requestOptions,
      promptTemplates: m.promptTemplates as any,
      capabilities: m.capabilities,
    })),
    systemMessage: final.systemMessage,
    completionOptions: final.completionOptions,
    slashCommands: final.slashCommands?.map((s) => ({
      name: s.name,
      description: s.description,
      params: s.params, //PZTODO: is this why params aren't referenced properly by slash commands?
    })),
    contextProviders: final.contextProviders?.map((c) => c.description),
    disableIndexing: final.disableIndexing,
    disableSessionTitles: final.disableSessionTitles,
    userToken: final.userToken,
    embeddingsProvider: final.embeddingsProvider?.id,
    ui: final.ui,
    experimental: final.experimental,
  };
}

function escapeSpacesInPath(p: string): string {
  return p.replace(/ /g, "\\ ");
}

async function handleEsbuildInstallation(ide: IDE, ideType: IdeType) {
  // JetBrains is currently the only IDE that we've reached the plugin size limit and
  // therefore need to install esbuild manually to reduce the size
  if (ideType !== "jetbrains") {
    return;
  }

  const globalContext = new GlobalContext();
  if (globalContext.get("hasDismissedConfigTsNoticeJetBrains")) {
    return;
  }

  const esbuildPath = getEsbuildBinaryPath();

  if (fs.existsSync(esbuildPath)) {
    return;
  }

  console.debug("No esbuild binary detected");

  const shouldInstall = await promptEsbuildInstallation(ide);

  if (shouldInstall) {
    await downloadAndInstallEsbuild(ide);
  }
}

async function promptEsbuildInstallation(ide: IDE): Promise<boolean> {
  const installMsg = "Install esbuild";
  const dismissMsg = "Dismiss";

  const res = await ide.showToast(
    "warning",
    "You're using a custom 'config.ts' file, which requires 'esbuild' to be installed. Would you like to install it now?",
    dismissMsg,
    installMsg,
  );

  if (res === dismissMsg) {
    const globalContext = new GlobalContext();
    globalContext.update("hasDismissedConfigTsNoticeJetBrains", true);
    return false;
  }

  return res === installMsg;
}

/**
 * The download logic is adapted from here: https://esbuild.github.io/getting-started/#download-a-build
 */
async function downloadAndInstallEsbuild(ide: IDE) {
  const esbuildPath = getEsbuildBinaryPath();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esbuild-"));

  try {
    const target = `${os.platform()}-${os.arch()}`;
    const version = "0.19.11";
    const url = `https://registry.npmjs.org/@esbuild/${target}/-/${target}-${version}.tgz`;
    const tgzPath = path.join(tempDir, `esbuild-${version}.tgz`);

    console.debug(`Downloading esbuild from: ${url}`);
    execSync(`curl -fo "${tgzPath}" "${url}"`);

    console.debug(`Extracting tgz file to: ${tempDir}`);
    await tar.x({
      file: tgzPath,
      cwd: tempDir,
      strip: 2, // Remove the top two levels of directories
    });

    // Ensure the destination directory exists
    const destDir = path.dirname(esbuildPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move the file
    const extractedBinaryPath = path.join(tempDir, "esbuild");
    fs.renameSync(extractedBinaryPath, esbuildPath);

    // Ensure the binary is executable (not needed on Windows)
    if (os.platform() !== "win32") {
      fs.chmodSync(esbuildPath, 0o755);
    }

    // Clean up
    fs.unlinkSync(tgzPath);
    fs.rmSync(tempDir, { recursive: true });

    await ide.showToast(
      "info",
      `'esbuild' successfully installed to ${esbuildPath}`,
    );
  } catch (error) {
    console.error("Error downloading or saving esbuild binary:", error);
    throw error;
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

  await handleEsbuildInstallation(ide, ideType);
  await tryBuildConfigTs();

  return readConfigJs();
}

async function loadFullConfigNode(
  ide: IDE,
  workspaceConfigs: ContinueRcJson[],
  ideSettings: IdeSettings,
  ideType: IdeType,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  overrideConfigJson: SerializedContinueConfig | undefined,
): Promise<ConfigResult<ContinueConfig>> {
  // Serialized config
  let {
    config: serialized,
    errors,
    configLoadInterrupted,
  } = loadSerializedConfig(
    workspaceConfigs,
    ideSettings,
    ideType,
    overrideConfigJson,
  );

  if (!serialized || configLoadInterrupted) {
    return { errors, config: undefined, configLoadInterrupted: true };
  }

  // Convert serialized to intermediate config
  let intermediate = await serializedToIntermediateConfig(serialized, ide);

  // Apply config.ts to modify intermediate config
  const configJsContents = await buildConfigTsandReadConfigJs(ide, ideType);
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
          module = await import(`file://${configJsPath}`);
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
  const finalConfig = await intermediateToFinalConfig(
    intermediate,
    ide,
    ideSettings,
    uniqueId,
    writeLog,
    workOsAccessToken,
  );
  return { config: finalConfig, errors, configLoadInterrupted: false };
}

export {
  finalToBrowserConfig,
  intermediateToFinalConfig,
  loadFullConfigNode,
  serializedToIntermediateConfig,
  type BrowserSerializedContinueConfig,
};
