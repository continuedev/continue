import * as fs from "fs";
import path from "path";
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
  IdeType,
  ModelDescription,
  SerializedContinueConfig,
  SlashCommand,
} from "..";
import {
  slashCommandFromDescription,
  slashFromCustomCommand,
} from "../commands";
import { contextProviderClassFromName } from "../context/providers";
import CustomContextProviderClass from "../context/providers/CustomContextProvider";
import FileContextProvider from "../context/providers/FileContextProvider";
import { AllEmbeddingsProviders } from "../indexing/embeddings";
import TransformersJsEmbeddingsProvider from "../indexing/embeddings/TransformersJsEmbeddingsProvider";
import { BaseLLM } from "../llm";
import { llmFromDescription } from "../llm/llms";
import CustomLLMClass from "../llm/llms/CustomLLM";
import { copyOf } from "../util";
import mergeJson from "../util/merge";
import {
  getConfigJsPath,
  getConfigJsPathForRemote,
  getConfigJsonPath,
  getConfigJsonPathForRemote,
  getConfigTsPath,
  getContinueDotEnv,
  migrate,
} from "../util/paths";
const { execSync } = require("child_process");

function resolveSerializedConfig(filepath: string): SerializedContinueConfig {
  let content = fs.readFileSync(filepath, "utf8");
  let config = JSON.parse(content) as SerializedContinueConfig;
  if (config.env && Array.isArray(config.env)) {
    const env = {
      ...process.env,
      ...getContinueDotEnv(),
    };

    config.env.forEach((envVar) => {
      content = content.replaceAll(
        new RegExp(`"${envVar}"`, "g"),
        `"${env[envVar]}"`,
      );
    });
  }

  return JSON.parse(content);
}

const configMergeKeys = {
  models: (a: any, b: any) => a.title === b.title,
  contextProviders: (a: any, b: any) => a.name === b.name,
  slashCommands: (a: any, b: any) => a.name === b.name,
  customCommands: (a: any, b: any) => a.name === b.name,
};

function loadSerializedConfig(
  workspaceConfigs: ContinueRcJson[],
  remoteConfigServerUrl: URL | undefined,
  ideType: IdeType,
): SerializedContinueConfig {
  const configPath = getConfigJsonPath(ideType);
  let config = resolveSerializedConfig(configPath);
  if (config.allowAnonymousTelemetry === undefined) {
    config.allowAnonymousTelemetry = true;
  }

  migrate("codebaseContextProvider", () => {
    if (
      !config.contextProviders?.filter((cp) => cp.name === "codebase")?.length
    ) {
      config.contextProviders = [
        ...(config.contextProviders || []),
        {
          name: "codebase",
          params: {},
        },
      ];
    }

    if (!config.embeddingsProvider) {
      config.embeddingsProvider = {
        provider: "transformers.js",
      };
    }

    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2), "utf8");
  });

  migrate("problemsContextProvider", () => {
    if (
      !config.contextProviders?.filter((cp) => cp.name === "problems")?.length
    ) {
      config.contextProviders = [
        ...(config.contextProviders || []),
        {
          name: "problems",
          params: {},
        },
      ];
    }

    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2), "utf8");
  });

  migrate("foldersContextProvider", () => {
    if (
      !config.contextProviders?.filter((cp) => cp.name === "folder")?.length
    ) {
      config.contextProviders = [
        ...(config.contextProviders || []),
        {
          name: "folder",
          params: {},
        },
      ];
    }

    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2), "utf8");
  });

  if (remoteConfigServerUrl) {
    const remoteConfigJson = resolveSerializedConfig(
      getConfigJsonPathForRemote(remoteConfigServerUrl),
    );
    config = mergeJson(config, remoteConfigJson, "merge", configMergeKeys);
  }

  for (const workspaceConfig of workspaceConfigs) {
    config = mergeJson(
      config,
      workspaceConfig,
      workspaceConfig.mergeBehavior,
      configMergeKeys,
    );
  }

  return config;
}

function serializedToIntermediateConfig(
  initial: SerializedContinueConfig,
): Config {
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
  readFile: (filepath: string) => Promise<string>,
): Promise<ContinueConfig> {
  const models: BaseLLM[] = [];
  for (const desc of config.models) {
    if (isModelDescription(desc)) {
      const llm = await llmFromDescription(
        desc,
        readFile,
        config.completionOptions,
        config.systemMessage,
      );
      if (!llm) continue;

      if (llm.model === "AUTODETECT") {
        try {
          const modelNames = await llm.listModels();
          const detectedModels = await Promise.all(
            modelNames.map(async (modelName) => {
              return await llmFromDescription(
                {
                  ...desc,
                  model: modelName,
                  title: llm.title + " - " + modelName,
                },
                readFile,
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
      const llm = new CustomLLMClass(desc);
      if (llm.model === "AUTODETECT") {
        try {
          const modelNames = await llm.listModels();
          const models = modelNames.map(
            (modelName) =>
              new CustomLLMClass({
                ...desc,
                options: { ...desc.options, model: modelName },
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

  let autocompleteLlm: BaseLLM | undefined = undefined;
  if (config.tabAutocompleteModel) {
    if (isModelDescription(config.tabAutocompleteModel)) {
      autocompleteLlm = await llmFromDescription(
        config.tabAutocompleteModel,
        readFile,
        config.completionOptions,
        config.systemMessage,
      );
    } else {
      autocompleteLlm = new CustomLLMClass(config.tabAutocompleteModel);
    }
  }

  const contextProviders: IContextProvider[] = [new FileContextProvider({})];
  for (const provider of config.contextProviders || []) {
    if (isContextProviderWithParams(provider)) {
      const cls = contextProviderClassFromName(provider.name) as any;
      if (!cls) {
        console.warn(`Unknown context provider ${provider.name}`);
        continue;
      }
      contextProviders.push(new cls(provider.params));
    } else {
      contextProviders.push(new CustomContextProviderClass(provider));
    }
  }

  if (
    (config.embeddingsProvider as EmbeddingsProviderDescription | undefined)
      ?.provider
  ) {
    const { provider, ...options } =
      config.embeddingsProvider as EmbeddingsProviderDescription;
    config.embeddingsProvider = new AllEmbeddingsProviders[provider](options);
  }

  if (!config.embeddingsProvider) {
    config.embeddingsProvider = new TransformersJsEmbeddingsProvider();
  }

  return {
    ...config,
    contextProviders,
    models,
    embeddingsProvider: config.embeddingsProvider as any,
    tabAutocompleteModel: autocompleteLlm,
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
      title: m.title || m.model,
      apiKey: m.apiKey,
      apiBase: m.apiBase,
      contextLength: m.contextLength,
      template: m.template,
      completionOptions: m.completionOptions,
      systemMessage: m.systemMessage,
      requestOptions: m.requestOptions,
      promptTemplates: m.promptTemplates,
    })),
    systemMessage: final.systemMessage,
    completionOptions: final.completionOptions,
    slashCommands: final.slashCommands?.map((m) => ({
      name: m.name,
      description: m.description,
      options: m.params,
    })),
    contextProviders: final.contextProviders?.map((c) => c.description),
    disableIndexing: final.disableIndexing,
    disableSessionTitles: final.disableSessionTitles,
    userToken: final.userToken,
    embeddingsProvider: final.embeddingsProvider?.id,
  };
}

function getTarget() {
  const os =
    {
      aix: "linux",
      darwin: "darwin",
      freebsd: "linux",
      linux: "linux",
      openbsd: "linux",
      sunos: "linux",
      win32: "win32",
    }[process.platform as string] ?? "linux";
  const arch = {
    arm: "arm64",
    arm64: "arm64",
    ia32: "x64",
    loong64: "arm64",
    mips: "arm64",
    mipsel: "arm64",
    ppc: "x64",
    ppc64: "x64",
    riscv64: "arm64",
    s390: "x64",
    s390x: "x64",
    x64: "x64",
  }[process.arch];

  return `${os}-${arch}`;
}

function escapeSpacesInPath(p: string): string {
  return p.replace(/ /g, "\\ ");
}

async function buildConfigTs() {
  if (!fs.existsSync(getConfigTsPath())) {
    return undefined;
  }

  try {
    if (process.env.IS_BINARY === "true") {
      execSync(
        escapeSpacesInPath(path.dirname(process.execPath)) +
          `/esbuild${
            getTarget().startsWith("win32") ? ".exe" : ""
          } ${escapeSpacesInPath(
            getConfigTsPath(),
          )} --bundle --outfile=${escapeSpacesInPath(
            getConfigJsPath(),
          )} --platform=node --format=cjs --sourcemap --external:fetch --external:fs --external:path --external:os --external:child_process`,
      );
    } else {
      // Dynamic import esbuild so potentially disastrous errors can be caught
      const esbuild = require("esbuild");

      await esbuild.build({
        entryPoints: [getConfigTsPath()],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: getConfigJsPath(),
        external: ["fetch", "fs", "path", "os", "child_process"],
        sourcemap: true,
      });
    }
  } catch (e) {
    console.log(
      "Build error. Please check your ~/.continue/config.ts file: " + e,
    );
    return undefined;
  }

  if (!fs.existsSync(getConfigJsPath())) {
    return undefined;
  }
  return fs.readFileSync(getConfigJsPath(), "utf8");
}

async function loadFullConfigNode(
  readFile: (filepath: string) => Promise<string>,
  workspaceConfigs: ContinueRcJson[],
  remoteConfigServerUrl: URL | undefined,
  ideType: IdeType,
): Promise<ContinueConfig> {
  let serialized = loadSerializedConfig(
    workspaceConfigs,
    remoteConfigServerUrl,
    ideType,
  );
  let intermediate = serializedToIntermediateConfig(serialized);

  const configJsContents = await buildConfigTs();
  if (configJsContents) {
    try {
      // Try config.ts first
      const configJsPath = getConfigJsPath();
      const module = await require(configJsPath);
      delete require.cache[require.resolve(configJsPath)];
      if (!module.modifyConfig) {
        throw new Error("config.ts does not export a modifyConfig function.");
      }
      intermediate = module.modifyConfig(intermediate);
    } catch (e) {
      console.log("Error loading config.ts: ", e);
    }
  }

  // Remote config.js
  if (remoteConfigServerUrl) {
    try {
      const configJsPathForRemote = getConfigJsPathForRemote(
        remoteConfigServerUrl,
      );
      const module = await require(configJsPathForRemote);
      delete require.cache[require.resolve(configJsPathForRemote)];
      if (!module.modifyConfig) {
        throw new Error("config.ts does not export a modifyConfig function.");
      }
      intermediate = module.modifyConfig(intermediate);
    } catch (e) {
      console.log("Error loading remotely set config.js: ", e);
    }
  }

  const finalConfig = await intermediateToFinalConfig(intermediate, readFile);
  return finalConfig;
}

export {
  finalToBrowserConfig,
  intermediateToFinalConfig,
  loadFullConfigNode,
  serializedToIntermediateConfig,
  type BrowserSerializedContinueConfig,
};
