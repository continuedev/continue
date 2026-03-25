import {
  mergeConfigYamlRequestOptions,
  ModelConfig,
} from "@continuedev/config-yaml";

import { ContinueConfig, ILLMLogger, LLMOptions } from "../..";
import { BaseLLM } from "../../llm";
import { LLMClasses } from "../../llm/llms";

const AUTODETECT = "AUTODETECT";

const ENV_STRING_KEYS = [
  "apiType",
  "apiVersion",
  "deployment",
  "deploymentId",
  "projectId",
  "region",
  "profile",
  "accessKeyId",
  "secretAccessKey",
  "modelArn",
  "aiGatewaySlug",
  "accountId",
] as const;

function applyEnvOptions(
  options: LLMOptions,
  env: Record<string, string | boolean | number>,
): void {
  if (
    "useLegacyCompletionsEndpoint" in env &&
    typeof env.useLegacyCompletionsEndpoint === "boolean"
  ) {
    options.useLegacyCompletionsEndpoint = env.useLegacyCompletionsEndpoint;
  }
  for (const key of ENV_STRING_KEYS) {
    if (key in env && typeof env[key] === "string") {
      (options as any)[key] = env[key];
    }
  }
}

function getModelClass(
  model: ModelConfig,
): (typeof LLMClasses)[number] | undefined {
  return LLMClasses.find((llm) => llm.providerName === model.provider);
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

  const contextLength =
    model.contextLength ?? model.defaultCompletionOptions?.contextLength;

  let options: LLMOptions = {
    ...rest,
    contextLength,
    completionOptions: {
      ...(model.defaultCompletionOptions ?? {}),
      model: model.model,
      maxTokens:
        model.defaultCompletionOptions?.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    logger: llmLogger,
    uniqueId,
    title: model.name,
    template: model.promptTemplates?.chat,
    promptTemplates: model.promptTemplates,
    baseAgentSystemMessage: model.chatOptions?.baseAgentSystemMessage,
    basePlanSystemMessage: model.chatOptions?.basePlanSystemMessage,
    baseChatSystemMessage: model.chatOptions?.baseSystemMessage,
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

  // Model capabilities - need to be undefined if not found
  // To fallback to our autodetection
  if (capabilities?.includes("tool_use")) {
    options.capabilities = {
      ...options.capabilities,
      tools: true,
    };
  }

  if (capabilities?.includes("image_input")) {
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
  if (model.env) {
    applyEnvOptions(options, model.env);
  }

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
