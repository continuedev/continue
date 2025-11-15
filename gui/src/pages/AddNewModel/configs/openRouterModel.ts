import { ModelPackage } from "./models";
import openRouterModelsData from "./openRouterModels.json";

interface OpenRouterModel {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    instruct_type: string | null;
    [key: string]: any;
  };
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
    [key: string]: any;
  };
  top_provider: {
    max_completion_tokens?: number;
    is_moderated: boolean;
    [key: string]: any;
  };
  per_request_limits: null | { [key: string]: any };
  supported_parameters: string[];
  default_parameters: null | { [key: string]: any };
}

/**
 * Convert OpenRouter model data to ModelPackage format
 */
function convertOpenRouterModelToPackage(model: OpenRouterModel): ModelPackage {
  // Extract provider name from id (e.g., "openai/gpt-5.1" -> "openai")
  const [provider] = model.id.split("/");

  // Create a friendly title from the name
  const title = model.name;

  // Extract context length
  const contextLength = model.context_length;

  // Get pricing info for display
  const pricingInfo = model.pricing
    ? `Prompt: $${model.pricing.prompt}/1K tokens, Completion: $${model.pricing.completion}/1K tokens`
    : "Pricing not available";

  return {
    title,
    description: model.description,
    refUrl: `https://openrouter.ai/models/${model.id}`,
    params: {
      model: model.id,
      contextLength,
    },
    isOpenSource: !!model.hugging_face_id,
    tags: [provider as any],
  };
}

/**
 * Generate ModelPackage objects from OpenRouter models JSON
 */
export function generateOpenRouterModels(): {
  [key: string]: ModelPackage;
} {
  const models: { [key: string]: ModelPackage } = {};

  const data = openRouterModelsData as { data: OpenRouterModel[] };

  if (!data.data || !Array.isArray(data.data)) {
    console.warn("Invalid OpenRouter models data structure");
    return models;
  }

  data.data.forEach((model: OpenRouterModel) => {
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

  return models;
}

/**
 * Export all OpenRouter models as a pre-generated object
 */
export const openRouterModels = generateOpenRouterModels();

/**
 * Export OpenRouter models as an array for use in provider packages
 */
export const openRouterModelsList = Object.values(openRouterModels);
