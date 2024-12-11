import fs from "node:fs";
import path from "path";

import {
  extendConfig,
  fillTemplateVariables,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { ConfigYaml } from "@continuedev/config-yaml/dist/schemas";
import { ValidationLevel } from "@continuedev/config-yaml/dist/validation";
import { fetchwithRequestOptions } from "@continuedev/fetch";
import * as YAML from "yaml";

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
import { contextProviderClassFromName } from "../../context/providers/index";
import { allEmbeddingsProviders } from "../../indexing/allEmbeddingsProviders";
import FreeTrial from "../../llm/llms/FreeTrial";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
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
  const continueConfig: ContinueConfig = {
    slashCommands: await slashCommandsFromV1PromptFiles(ide),
    models: [],
    tabAutocompleteModels: [],
    tools: [],
    embeddingsProvider: new TransformersJsEmbeddingsProvider(),
    experimental: {
      modelContextProtocolServers: [],
    },
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
      );
      continueConfig.models.push(...llms);
    } else if (model.roles?.includes("autocomplete")) {
      // Autocomplete models array
      const llms = await llmsFromModelConfig(
        model,
        ide,
        uniqueId,
        ideSettings,
        writeLog,
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

  // Context
  continueConfig.contextProviders = config.context
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

export { type BrowserSerializedContinueConfig };
