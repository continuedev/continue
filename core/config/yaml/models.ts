import { ModelConfig } from "@continuedev/config-yaml";

import { IDE, IdeSettings, LLMOptions } from "../..";
import { BaseLLM } from "../../llm";
import { LLMClasses } from "../../llm/llms";

const AUTODETECT = "AUTODETECT";

async function modelConfigToBaseLLM(
  model: ModelConfig,
  uniqueId: string,
  ideSettings: IdeSettings,
  writeLog: (log: string) => Promise<void>,
): Promise<BaseLLM | undefined> {
  const cls = LLMClasses.find((llm) => llm.providerName === model.provider);

  if (!cls) {
    return undefined;
  }

  let options: LLMOptions = {
    ...model,
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
  };

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
            name: `${llm.title} - ${modelName}`,
          },
          uniqueId,
          ideSettings,
          writeLog,
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
): Promise<BaseLLM[]> {
  const baseLlm = await modelConfigToBaseLLM(
    model,
    uniqueId,
    ideSettings,
    writeLog,
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
    );
    return models;
  } else {
    return [baseLlm];
  }
}
