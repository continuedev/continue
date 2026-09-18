import { IIdeMessenger } from "../../../context/IdeMessenger";
import { ModelPackage } from "./models";

interface FetchedModel {
  name: string;
  modelId?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
  supportsImages?: boolean;
}

function modelParams(model: FetchedModel): Record<string, any> {
  return {
    contextLength: model.contextLength,
    capabilities: {
      tools: model.supportsTools,
      uploadImage: model.supportsImages,
    },
    completionOptions: { maxTokens: model.maxTokens },
  };
}

function toGenericPackage(model: FetchedModel, provider: string): ModelPackage {
  const id = model.modelId ?? model.name;
  return {
    title: model.name,
    description: model.name,
    params: {
      title: model.name,
      model: id,
      ...modelParams(model),
    },
    isOpenSource: false,
    providerOptions: [provider],
  };
}

async function fetchModels(
  ideMessenger: IIdeMessenger,
  provider: string,
  apiKey?: string,
  apiBase?: string,
): Promise<FetchedModel[]> {
  const response = await ideMessenger.request("models/fetch", {
    provider,
    apiKey,
    apiBase,
  });
  if (response.status === "error" || !response.content) {
    return [];
  }
  return response.content.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProviderModels(
  ideMessenger: IIdeMessenger,
  provider: string,
  apiKey: string,
  apiBase?: string,
): Promise<ModelPackage[]> {
  const models = await fetchModels(ideMessenger, provider, apiKey, apiBase);
  return models.map((m) => toGenericPackage(m, provider));
}
