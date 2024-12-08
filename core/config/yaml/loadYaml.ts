import fs from "node:fs";
import path from "path";
import * as YAML from "yaml";

import {
  extendConfig,
  fillTemplateVariables,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { ConfigYaml } from "@continuedev/config-yaml/dist/schemas";
import { ValidationLevel } from "@continuedev/config-yaml/dist/validation";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IDE,
  IdeSettings,
  IdeType,
  SlashCommand,
} from "../..";
import MCPConnectionSingleton from "../../context/mcp";
import { contextProviderClassFromName } from "../../context/providers/index";
import { BaseLLM } from "../../llm";
import FreeTrial from "../../llm/llms/FreeTrial";
import { allTools } from "../../tools";
import {
  getConfigYamlPath,
  getContinueDotEnv,
  readAllGlobalPromptFiles,
} from "../../util/paths";
import { getSystemPromptDotFile } from "../getSystemPromptDotFile";
import {
  DEFAULT_PROMPTS_FOLDER,
  getPromptFiles,
  slashCommandFromPromptFile,
} from "../promptFile.js";
import { ConfigValidationError } from "../validation.js";
import { llmsFromModelConfig } from "./models";

export interface ConfigResult<T> {
  config: T | undefined;
  errors: ConfigValidationError[] | undefined;
  configLoadInterrupted: boolean;
}

function renderTemplateVars(configYaml: string): string {
  const data: Record<string, string> = {};

  // env.*
  const envVars = getContinueDotEnv();
  Object.entries(envVars).forEach(([key, value]) => {
    data[`env.${key}`] = value;
  });

  // secrets.* not filled in

  return fillTemplateVariables(configYaml, data);
}

function loadConfigYaml(
  workspaceConfigs: string[],
  ideSettings: IdeSettings,
  ideType: IdeType,
  rawYaml: string,
): ConfigResult<ConfigYaml> {
  const renderedYaml = renderTemplateVars(rawYaml);
  let config = YAML.parse(renderedYaml) as ConfigYaml;
  const errors = validateConfigYaml(config);

  if (errors?.some((error) => error.level === ValidationLevel.Error)) {
    return {
      errors: errors.map((error) => ({
        message: error.message,
        fatal: error.level === ValidationLevel.Error,
      })),
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  for (const workspaceConfig of workspaceConfigs) {
    const rendered = renderTemplateVars(workspaceConfig);
    config = extendConfig(config, YAML.parse(rendered) as ConfigYaml);
  }

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  return {
    config,
    errors: errors.map((error) => ({
      message: error.message,
      fatal: error.level === ValidationLevel.Error,
    })),
    configLoadInterrupted: false,
  };
}

async function slashCommandsFromV1PromptFiles(
  ide: IDE,
): Promise<SlashCommand[]> {
  const slashCommands: SlashCommand[] = [];
  const workspaceDirs = await ide.getWorkspaceDirs();

  // v1 prompt files
  let promptFiles: { path: string; content: string }[] = [];
  promptFiles = (
    await Promise.all(
      workspaceDirs.map((dir) =>
        getPromptFiles(ide, path.join(dir, DEFAULT_PROMPTS_FOLDER)),
      ),
    )
  )
    .flat()
    .filter(({ path }) => path.endsWith(".prompt"));

  // Also read from ~/.continue/.prompts
  promptFiles.push(...readAllGlobalPromptFiles());

  for (const file of promptFiles) {
    const slashCommand = slashCommandFromPromptFile(file.path, file.content);
    if (slashCommand) {
      slashCommands.push(slashCommand);
    }
  }

  return slashCommands;
}

async function configYamlToContinueConfig(
  config: ConfigYaml,
  ide: IDE,
  ideSettings: IdeSettings,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  allowFreeTrial: boolean = true,
): Promise<ContinueConfig> {
  const slashCommands = await slashCommandsFromV1PromptFiles(ide);

  // Models
  let models: BaseLLM[] = [];
  for (const model of config.models ?? []) {
    const llms = await llmsFromModelConfig(
      model,
      ide,
      uniqueId,
      ideSettings,
      writeLog,
    );
    models.push(...llms);
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

  // TODO: Split into model roles.

  // Context
  const contextProviders = config.context
    ?.map((context) => {
      const cls = contextProviderClassFromName(context.uses) as any;
      if (!cls) {
        console.warn(`Unknown context provider ${context.uses}`);
        return undefined;
      }
      const instance: IContextProvider = new cls(context.with ?? {});
      return instance;
    })
    .filter((p) => !!p) as IContextProvider[];

  // Embeddings Provider - TODO
  // const embeddingsProviderDescription = config.embeddingsProvider as
  //   | EmbeddingsProviderDescription
  //   | undefined;
  // if (embeddingsProviderDescription?.provider) {
  //   const { provider, ...options } = embeddingsProviderDescription;
  //   const embeddingsProviderClass = allEmbeddingsProviders[provider];
  //   if (embeddingsProviderClass) {
  //     if (
  //       embeddingsProviderClass.name === "_TransformersJsEmbeddingsProvider"
  //     ) {
  //       config.embeddingsProvider = new embeddingsProviderClass();
  //     } else {
  //       config.embeddingsProvider = new embeddingsProviderClass(
  //         options,
  //         (url: string | URL, init: any) =>
  //           fetchwithRequestOptions(url, init, {
  //             ...config.requestOptions,
  //             ...options.requestOptions,
  //           }),
  //       );
  //     }
  //   }
  // }

  // if (!config.embeddingsProvider) {
  //   config.embeddingsProvider = new TransformersJsEmbeddingsProvider();
  // }

  // Reranker
  // if (config.reranker && !(config.reranker as Reranker | undefined)?.rerank) {
  //   const { name, params } = config.reranker as RerankerDescription;
  //   const rerankerClass = AllRerankers[name];

  //   if (name === "llm") {
  //     const llm = models.find((model) => model.title === params?.modelTitle);
  //     if (!llm) {
  //       console.warn(`Unknown model ${params?.modelTitle}`);
  //     } else {
  //       config.reranker = new LLMReranker(llm);
  //     }
  //   } else if (rerankerClass) {
  //     config.reranker = new rerankerClass(params);
  //   }
  // }

  let continueConfig: ContinueConfig = {
    ...config,
    contextProviders,
    models,
    embeddingsProvider: config.embeddingsProvider as any,
    tabAutocompleteModels,
    reranker: config.reranker as any,
    tools: allTools,
  };

  // Apply MCP if specified
  if (config.experimental?.modelContextProtocolServer) {
    const mcpConnection = await MCPConnectionSingleton.getInstance(
      config.experimental.modelContextProtocolServer,
    );
    continueConfig = await Promise.race<ContinueConfig>([
      mcpConnection.modifyConfig(continueConfig),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("MCP connection timed out after 2000ms")),
          2000,
        ),
      ),
    ]).catch((error) => {
      console.warn("MCP connection error:", error);
      return continueConfig; // Return original config if timeout occurs
    });
  }

  return continueConfig;
}

export async function loadContinueConfig(
  ide: IDE,
  workspaceConfigs: string[],
  ideSettings: IdeSettings,
  ideType: IdeType,
  uniqueId: string,
  writeLog: (log: string) => Promise<void>,
  workOsAccessToken: string | undefined,
  overrideConfigYaml: string | undefined,
): Promise<ConfigResult<ContinueConfig>> {
  const configYamlPath = getConfigYamlPath(ideType);
  const rawYaml = fs.readFileSync(configYamlPath, "utf-8");

  const configYamlResult = await loadConfigYaml(
    workspaceConfigs,
    ideSettings,
    ideType,
    overrideConfigYaml ?? rawYaml,
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

export {
  loadContinueConfig as loadFullConfigNode,
  type BrowserSerializedContinueConfig,
};
