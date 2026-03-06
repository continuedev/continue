import {
  mergeConfigYamlRequestOptions,
  ModelConfig,
} from "@continuedev/config-yaml";
import { findLlmInfo } from "@continuedev/llm-info";

import { ContinueConfig, ILLMLogger, LLMOptions } from "../..";
import { BaseLLM } from "../../llm";
import { LLMClasses } from "../../llm/llms";

const AUTODETECT = "AUTODETECT";

function getModelClass(
  model: ModelConfig,
): (typeof LLMClasses)[number] | undefined {
  return LLMClasses.find((llm) => llm.providerName === model.provider);
}

function applyCapabilities(options: LLMOptions, model: ModelConfig): void {
  const { capabilities } = model;
  // Model capabilities - need to be undefined if not found
  // To fallback to our autodetection
  if (capabilities?.find((c) => c === "tool_use")) {
    options.capabilities = {
      ...options.capabilities,
      tools: true,
    };
  }

  if (capabilities?.find((c) => c === "image_input")) {
    options.capabilities = {
      ...options.capabilities,
      uploadImage: true,
    };
  }
}

function applyEmbedOptions(options: LLMOptions, model: ModelConfig): void {
  if (model.embedOptions?.maxBatchSize) {
    options.maxEmbeddingBatchSize = model.embedOptions.maxBatchSize;
  }
  if (model.embedOptions?.maxChunkSize) {
    options.maxEmbeddingChunkSize = model.embedOptions.maxChunkSize;
  }
}

function applyEnvOptions(
  options: LLMOptions,
  env: Record<string, unknown>,
): void {
  if (
    "useLegacyCompletionsEndpoint" in env &&
    typeof env.useLegacyCompletionsEndpoint === "boolean"
  ) {
    options.useLegacyCompletionsEndpoint = env.useLegacyCompletionsEndpoint;
  }
  if ("apiType" in env && typeof env.apiType === "string") {
    options.apiType = env.apiType;
  }
  if ("apiVersion" in env && typeof env.apiVersion === "string") {
    options.apiVersion = env.apiVersion;
  }
  if ("deployment" in env && typeof env.deployment === "string") {
    options.deployment = env.deployment;
  }
  if ("deploymentId" in env && typeof env.deploymentId === "string") {
    options.deploymentId = env.deploymentId;
  }
  if ("projectId" in env && typeof env.projectId === "string") {
    options.projectId = env.projectId;
  }
  if ("region" in env && typeof env.region === "string") {
    options.region = env.region;
  }
  if ("profile" in env && typeof env.profile === "string") {
    options.profile = env.profile;
  }
  if ("accessKeyId" in env && typeof env.accessKeyId === "string") {
    options.accessKeyId = env.accessKeyId;
  }
  if ("secretAccessKey" in env && typeof env.secretAccessKey === "string") {
    options.secretAccessKey = env.secretAccessKey;
  }
  if ("modelArn" in env && typeof env.modelArn === "string") {
    options.modelArn = env.modelArn;
  }
  if ("aiGatewaySlug" in env && typeof env.aiGatewaySlug === "string") {
    options.aiGatewaySlug = env.aiGatewaySlug;
  }
  if ("accountId" in env && typeof env.accountId === "string") {
    options.accountId = env.accountId;
  }
}

// function getContinueProxyModelName(
//   ownerSlug: string,
//   packageSlug: string,
//   model: ModelConfig,
// ): string {
//   return `${ownerSlug}/${packageSlug}/${model.provider}/${model.model}`;
// }

async function modelConfigToBaseLLM({
  model,
  uniqueId,
  llmLogger,
  config,
  isFromAutoDetect,
}: {
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
  isFromAutoDetect?: boolean;
}): Promise<BaseLLM | undefined> {
  const cls = getModelClass(model);

  if (!cls) {
    return undefined;
  }

  const { capabilities, ...rest } = model;

  const mergedRequestOptions = mergeConfigYamlRequestOptions(
    rest.requestOptions,
    config.requestOptions,
  );

  const llmInfo = findLlmInfo(model.model, model.provider);
  const contextLength =
    model.defaultCompletionOptions?.contextLength ?? llmInfo?.contextLength;
  const maxCompletionTokens = llmInfo?.maxCompletionTokens;
  const defaultMaxTokens =
    maxCompletionTokens && contextLength
      ? Math.min(maxCompletionTokens, contextLength / 4)
      : undefined;

  let options: LLMOptions = {
    ...rest,
    contextLength: contextLength,
    completionOptions: {
      ...(model.defaultCompletionOptions ?? {}),
      model: model.model,
      maxTokens:
        model.defaultCompletionOptions?.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens ??
        defaultMaxTokens,
    },
    logger: llmLogger,
    uniqueId,
    title: model.name,
    template: model.promptTemplates?.chat,
    promptTemplates: model.promptTemplates,
    baseAgentSystemMessage:
      model.chatOptions?.baseAgentSystemMessage ??
      cls.defaultOptions?.baseAgentSystemMessage,
    basePlanSystemMessage:
      model.chatOptions?.basePlanSystemMessage ??
      cls.defaultOptions?.basePlanSystemMessage,
    baseChatSystemMessage:
      model.chatOptions?.baseSystemMessage ??
      cls.defaultOptions?.baseChatSystemMessage,
    toolOverrides: model.chatOptions?.toolOverrides
      ? Object.entries(model.chatOptions.toolOverrides).map(([name, o]) => ({
          name,
          ...o,
        }))
      : undefined,
    capabilities: {
      tools: model.capabilities?.includes("tool_use"),
      uploadImage: model.capabilities?.includes("image_input"),
      nextEdit: model.capabilities?.includes("next_edit"),
    },
    autocompleteOptions: model.autocompleteOptions,
    isFromAutoDetect,
    requestOptions: mergedRequestOptions,
  };

  // Apply capabilities from model config
  applyCapabilities(options, model);

  applyEmbedOptions(options, model);

  // Apply environment-specific options
  const env = model.env ?? {};
  applyEnvOptions(options, env);

  const llm = new cls(options);
  return llm;
}

async function autodetectModels({
  llm,
  model,
  uniqueId,
  llmLogger,
  config,
}: {
  llm: BaseLLM;
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
}): Promise<BaseLLM[]> {
  try {
    const modelNames = await llm.listModels();
    const detectedModels = await Promise.all(
      modelNames.map(async (modelName) => {
        // To ensure there are no infinite loops
        if (modelName === AUTODETECT) {
          return undefined;
        }
        return await modelConfigToBaseLLM({
          model: {
            ...model,
            model: modelName,
            name: modelName,
          },
          uniqueId,
          llmLogger,
          config,
          isFromAutoDetect: true,
        });
      }),
    );
    return detectedModels.filter((x) => typeof x !== "undefined") as BaseLLM[];
  } catch (e) {
    console.warn("Error listing models: ", e);
    return [];
  }
}

export async function llmsFromModelConfig({
  model,
  uniqueId,
  llmLogger,
  config,
}: {
  model: ModelConfig;
  uniqueId: string;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
}): Promise<BaseLLM[]> {
  const baseLlm = await modelConfigToBaseLLM({
    model,
    uniqueId,
    llmLogger,
    config,
  });
  if (!baseLlm) {
    return [];
  }

  if (model.model === AUTODETECT) {
    const models = await autodetectModels({
      llm: baseLlm,
      model,
      uniqueId,
      llmLogger,
      config,
    });
    return models;
  } else {
    return [baseLlm];
  }
}
