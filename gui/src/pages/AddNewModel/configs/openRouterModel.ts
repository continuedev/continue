import { ModelPackage } from "./models";

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  hugging_face_id: string;
}

/**
 * Convert OpenRouter model data to ModelPackage format
 */
function convertOpenRouterModelToPackage(model: OpenRouterModel): ModelPackage {
  // Extract provider name from id (e.g., "openai/gpt-5.1" -> "openai")
  const [provider] = model.id.split("/");

  return {
    title: model.name,
    description: model.description,
    refUrl: `https://openrouter.ai/models/${model.id}`,
    params: {
      model: model.id,
      contextLength: model.context_length,
    },
    isOpenSource: !!model.hugging_face_id,
    tags: [provider as any],
  };
}

/**
 * Fetch OpenRouter models from the API
 */
async function fetchOpenRouterModelsFromAPI(): Promise<OpenRouterModel[]> {
  const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";

  try {
    const response = await fetch(OPENROUTER_API_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      console.warn("Invalid OpenRouter models data structure from API");
      return [];
    }

    return data.data;
  } catch (error) {
    console.error("Error fetching OpenRouter models from API:", error);
    return [];
  }
}

export async function getOpenRouterModelsList(): Promise<ModelPackage[]> {
  const models: { [key: string]: ModelPackage } = {};

  const apiModels = await fetchOpenRouterModelsFromAPI();

  apiModels.forEach((model: OpenRouterModel) => {
    if (!model.id || !model.name) {
      console.warn("Skipping model with missing id or name", model);
      return;
    }

    // Create a unique key from the model id (replace slashes and dots with underscores)
    const key = model.id.replace(/[\/.]/g, "_");

    try {
      models[key] = convertOpenRouterModelToPackage(model);
    } catch (error) {
      console.error(`Failed to convert model ${model.id}:`, error);
    }
  });

  return Object.values(models);
}
