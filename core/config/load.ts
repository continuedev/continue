import * as fs from "fs";
import {
  BaseCompletionOptions,
  Config,
  ContextProviderWithParams,
  ContinueConfig,
  CustomContextProvider,
  CustomLLM,
  EmbeddingsProviderDescription,
  IContextProvider,
  ModelDescription,
  SerializedContinueConfig,
  SlashCommand,
  SlashCommandDescription,
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
import {
  getConfigJsPath,
  getConfigJsonPath,
  getConfigTsPath,
  migrate,
} from "../util/paths";

function loadSerializedConfig(
  workspaceConfigs: Partial<SerializedContinueConfig>[]
): SerializedContinueConfig {
  const configPath = getConfigJsonPath();
  let contents = fs.readFileSync(configPath, "utf8");
  let config = JSON.parse(contents) as SerializedContinueConfig;
  if (config.allowAnonymousTelemetry === undefined) {
    config.allowAnonymousTelemetry = true;
  }

  // Migrate to camelCase - replace all instances of "snake_case" with "camelCase"
  migrate("camelCaseConfig", () => {
    contents = contents
      .replace(/(_\w)/g, function (m) {
        return m[1].toUpperCase();
      })
      .replace("openai-aiohttp", "openai");

    fs.writeFileSync(configPath, contents, "utf8");
  });

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

  migrate("renameFreeTrialProvider", () => {
    contents = contents.replace(/openai-free-trial/g, "free-trial");
    fs.writeFileSync(configPath, contents, "utf8");
  });

  for (const workspaceConfig of workspaceConfigs) {
    config = mergeJson(config, workspaceConfig);
  }

  return config;
}

function serializedToIntermediateConfig(
  initial: SerializedContinueConfig
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
  llm: ModelDescription | CustomLLM
): llm is ModelDescription {
  return (llm as ModelDescription).title !== undefined;
}

function isContextProviderWithParams(
  contextProvider: CustomContextProvider | ContextProviderWithParams
): contextProvider is ContextProviderWithParams {
  return (contextProvider as ContextProviderWithParams).name !== undefined;
}

/** Only difference between intermediate and final configs is the `models` array */
async function intermediateToFinalConfig(
  config: Config,
  readFile: (filepath: string) => Promise<string>
): Promise<ContinueConfig> {
  const models: BaseLLM[] = [];
  for (const desc of config.models) {
    let llm: BaseLLM | undefined;
    if (isModelDescription(desc)) {
      llm = await llmFromDescription(
        desc,
        readFile,
        config.completionOptions,
        config.systemMessage
      );
    } else {
      llm = new CustomLLMClass(desc);
    }
    if (!llm) continue;
    models.push(llm);
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
  };
}

interface BrowserSerializedContinueConfig {
  allowAnonymousTelemetry?: boolean;
  models: ModelDescription[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  slashCommands?: SlashCommandDescription[];
  contextProviders?: ContextProviderWithParams[];
  disableIndexing?: boolean;
  disableSessionTitles?: boolean;
  userToken?: string;
  embeddingsProvider?: string;
}

function finalToBrowserConfig(
  final: ContinueConfig
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
    slashCommands: final.slashCommands?.map((m) => m.description),
    contextProviders: final.contextProviders?.map((c) => c.description),
    disableIndexing: final.disableIndexing,
    disableSessionTitles: final.disableSessionTitles,
    userToken: final.userToken,
    embeddingsProvider: final.embeddingsProvider?.id,
  };
}

async function buildConfigTs(browser: boolean) {
  if (!fs.existsSync(getConfigTsPath())) {
    return undefined;
  }

  try {
    // Dynamic import esbuild so potentially disastrous errors can be caught
    const esbuild = require("esbuild");

    await esbuild.build({
      entryPoints: [getConfigTsPath()],
      bundle: true,
      platform: browser ? "browser" : "node",
      format: browser ? "esm" : "cjs",
      outfile: getConfigJsPath(!browser),
      external: ["fetch", "fs", "path", "os", "child_process"],
      sourcemap: true,
    });
  } catch (e) {
    throw new Error(
      "Build error. Please check your ~/.continue/config.ts file: " + e
    );
    return undefined;
  }

  if (!fs.existsSync(getConfigJsPath(!browser))) {
    return undefined;
  }
  return fs.readFileSync(getConfigJsPath(!browser), "utf8");
}

async function loadFullConfigNode(
  readFile: (filepath: string) => Promise<string>,
  workspaceConfigs: Partial<SerializedContinueConfig>[]
): Promise<ContinueConfig> {
  let serialized = loadSerializedConfig(workspaceConfigs);
  let intermediate = serializedToIntermediateConfig(serialized);

  const configJsContents = await buildConfigTs(false);
  if (configJsContents) {
    try {
      // Try config.ts first
      const configJsPath = getConfigJsPath(true);
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
