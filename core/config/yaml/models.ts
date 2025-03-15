import { ModelConfig } from "@continuedev/config-yaml";

import { IDE, IdeSettings, LLMOptions } from "../..";
import { BaseLLM } from "../../llm";
import { LLMClasses } from "../../llm/llms";
import { PlatformConfigMetadata } from "../profile/PlatformProfileLoader";

const AUTODETECT = "AUTODETECT";

function getModelClass(
  model: ModelConfig,
): (typeof LLMClasses)[number] | undefined {
  return LLMClasses.find((llm) => llm.providerName === model.provider);
}

function getContinueProxyModelName(
  ownerSlug: string,
  packageSlug: string,
  model: ModelConfig,
): string {
  return `${ownerSlug}/${packageSlug}/${model.provider}/${model.model}`;
}

async function modelConfigToBaseLLM(
  model: ModelConfig,
  uniqueId: string,
  ideSettings: IdeSettings,
  writeLog: (log: string) => Promise<void>,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  systemMessage: string | undefined,
): Promise<BaseLLM | undefined> {
  const cls = getModelClass(model);

  if (!cls) {
    return undefined;
  }

  const { capabilities, ...rest } = model;

  let options: LLMOptions = {
    ...rest,
    // contextLength: model.defaultCompletionOptions?.contextLength ?? undefined,
    completionOptions: {
      ...(model.defaultCompletionOptions ?? {}),
      model: model.model,
      maxTokens:
        model.defaultCompletionOptions?.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    writeLog,
    uniqueId,
    title: model.name,
    systemMessage,
    promptTemplates: model.promptTemplates,
    capabilities: {
      tools: model.capabilities?.includes("tool_use"),
      uploadImage: model.capabilities?.includes("image_input"),
    },
  };

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

  if (model.embedOptions?.maxBatchSize) {
    options.maxEmbeddingBatchSize = model.embedOptions.maxBatchSize;
  }
  if (model.embedOptions?.maxChunkSize) {
    options.maxEmbeddingChunkSize = model.embedOptions.maxChunkSize;
  }

  // These are params that are at model config level in JSON
  // But we decided to move to nested `env` in YAML
  // Since types vary and we don't want to blindly spread env for now,
  // Each one is handled individually here
  const env = model.env ?? {};
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
  if ("modelArn" in env && typeof env.modelArn === "string") {
    options.modelArn = env.modelArn;
  }
  if ("aiGatewaySlug" in env && typeof env.aiGatewaySlug === "string") {
    options.aiGatewaySlug = env.aiGatewaySlug;
  }
  if ("accountId" in env && typeof env.accountId === "string") {
    options.accountId = env.accountId;
  }

  const llm = new cls(options);
  return llm;
}

async function autodetectModels(
  llm: BaseLLM,
  model: ModelConfig,
  ide: IDE,
  uniqueId: string,
  ideSettings: IdeSettings,
  writeLog: (log: string) => Promise<void>,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  systemMessage: string | undefined,
): Promise<BaseLLM[]> {
  try {
    const modelNames = await llm.listModels();
    const detectedModels = await Promise.all(
      modelNames.map(async (modelName) => {
        // To ensure there are no infinite loops
        if (modelName === AUTODETECT) {
          return undefined;
        }

        return await modelConfigToBaseLLM(
          {
            ...model,
            model: modelName,
            name: modelName,
          },
          uniqueId,
          ideSettings,
          writeLog,
          platformConfigMetadata,
          systemMessage,
        );
      }),
    );
    return detectedModels.filter((x) => typeof x !== "undefined") as BaseLLM[];
  } catch (e) {
    console.warn("Error listing models: ", e);
    return [];
  }
}

export async function llmsFromModelConfig(
  model: ModelConfig,
  ide: IDE,
  uniqueId: string,
  ideSettings: IdeSettings,
  writeLog: (log: string) => Promise<void>,
  platformConfigMetadata: PlatformConfigMetadata | undefined,
  systemMessage: string | undefined,
): Promise<BaseLLM[]> {
  const baseLlm = await modelConfigToBaseLLM(
    model,
    uniqueId,
    ideSettings,
    writeLog,
    platformConfigMetadata,
    systemMessage,
  );
  if (!baseLlm) {
    return [];
  }

  if (model.model === AUTODETECT) {
    const models = await autodetectModels(
      baseLlm,
      model,
      ide,
      uniqueId,
      ideSettings,
      writeLog,
      platformConfigMetadata,
      systemMessage,
    );
    return models;
  } else {
    return [baseLlm];
  }
}
