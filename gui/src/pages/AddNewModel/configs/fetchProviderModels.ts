import { ModelProviderTags } from "../../../components/modelSelection/utils";
import { IIdeMessenger } from "../../../context/IdeMessenger";
import { ModelPackage } from "./models";
import { models } from "./models";
import { ollamaStaticModels, providers } from "./providers";

interface FetchedModel {
  name: string;
  modelId?: string;
  description?: string;
  icon?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
  /** Continue provider that must run the model (Claude on DotHoosh uses "anthropic"). */
  provider?: string;
  apiBase?: string;
}

function modelParams(model: FetchedModel): Record<string, any> {
  const params: Record<string, any> = {};
  if (model.contextLength) params.contextLength = model.contextLength;
  if (model.maxTokens) {
    params.completionOptions = { maxTokens: model.maxTokens };
  }
  if (model.supportsTools) {
    params.capabilities = { tools: true };
  }
  if (model.provider) params.provider = model.provider;
  if (model.apiBase) params.apiBase = model.apiBase;
  return params;
}

function toOllamaPackage(model: FetchedModel): ModelPackage {
  return {
    title: model.name,
    description: model.description || model.name,
    refUrl: `https://ollama.com/library/${model.name}`,
    params: {
      title: model.name,
      model: model.name,
      ...(model.supportsTools ? { capabilities: { tools: true } } : {}),
    },
    isOpenSource: true,
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    providerOptions: ["ollama"],
    icon: model.icon ?? "ollama.png",
  };
}

function toOpenRouterPackage(model: FetchedModel): ModelPackage {
  const id = model.modelId ?? model.name;
  return {
    title: model.name,
    description: model.name,
    refUrl: `https://openrouter.ai/models/${id}`,
    params: {
      title: model.name,
      model: id,
      ...modelParams(model),
    },
    isOpenSource: false,
    tags: [ModelProviderTags.RequiresApiKey],
    providerOptions: ["openrouter"],
    icon: model.icon ?? "openrouter.png",
  };
}

function toDotHooshPackage(model: FetchedModel): ModelPackage {
  const id = model.modelId ?? model.name;
  return {
    title: model.name,
    description: `${model.name}, served through the DotHoosh gateway`,
    params: {
      title: model.name,
      model: id,
      ...modelParams(model),
    },
    isOpenSource: false,
    providerOptions: [model.provider ?? "dothoosh"],
    icon: model.icon ?? "dothoosh.png",
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
  return models.map((m) =>
    provider === "dothoosh"
      ? toDotHooshPackage(m)
      : toGenericPackage(m, provider),
  );
}

export async function initializeDynamicModels(ideMessenger: IIdeMessenger) {
  const ollamaAutodetect = {
    ...models.AUTODETECT,
    params: { ...models.AUTODETECT.params, title: "Ollama" },
  };

  if (providers.ollama) {
    providers.ollama.popularPackages = [
      ollamaAutodetect,
      ...ollamaStaticModels,
    ];

    try {
      const fetched = await fetchModels(ideMessenger, "ollama");
      const fetchedPkgs = fetched.map(toOllamaPackage);
      const popularTitles = new Set(
        providers.ollama.popularPackages.map((p) => p.title),
      );
      const additional = fetchedPkgs.filter((p) => !popularTitles.has(p.title));
      providers.ollama.packages = [
        ...providers.ollama.popularPackages,
        ...additional,
      ];
    } catch (error) {
      console.error("Failed to initialize Ollama models:", error);
      providers.ollama.packages = [...providers.ollama.popularPackages];
    }
  }

  try {
    const fetched = await fetchModels(ideMessenger, "openrouter");
    const packages = fetched.map(toOpenRouterPackage);
    if (packages.length > 0 && providers.openrouter) {
      providers.openrouter.packages = packages;
    }
  } catch (error) {
    console.error("Failed to initialize OpenRouter models:", error);
  }

  try {
    const fetched = await fetchModels(ideMessenger, "dothoosh");
    const packages = fetched.map(toDotHooshPackage);
    if (packages.length > 0 && providers.dothoosh) {
      providers.dothoosh.packages = packages;
    }
  } catch (error) {
    console.error("Failed to initialize DotHoosh models:", error);
  }
}
