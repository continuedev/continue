import { ModelProviderTags } from "../../../components/modelSelection/utils";
import { ModelPackage } from "./models";

interface OllamaLibraryModel {
  name: string;
  description: string;
  capabilities: string[];
  sizes: string[];
}

const VISION_CAPABILITIES = ["vision", "audio"];
const EXCLUDED_CAPABILITIES = [...VISION_CAPABILITIES, "embedding"];

function convertOllamaModelToPackage(model: OllamaLibraryModel): ModelPackage {
  const sizeLabel =
    model.sizes.length > 0 ? ` (${model.sizes.join(", ")})` : "";
  return {
    title: model.name,
    description: model.description || `Ollama model: ${model.name}${sizeLabel}`,
    refUrl: `https://ollama.com/library/${model.name}`,
    params: {
      title: model.name,
      model: model.name,
      contextLength: 4096,
    },
    isOpenSource: true,
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    providerOptions: ["ollama"],
    icon: "ollama.png",
  };
}

function parseModelsFromHtml(html: string): OllamaLibraryModel[] {
  const models: OllamaLibraryModel[] = [];
  const items = html.split("x-test-model class=");

  // Skip the first split (before any model entry)
  for (let i = 1; i < items.length; i++) {
    const item = items[i];

    // Extract model name from href
    const nameMatch = item.match(/href="\/library\/([^"]+)"/);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1];

    // Extract capabilities (vision, tools, thinking, embedding, etc.)
    const capabilities: string[] = [];
    const capRegex = /x-test-capability[^>]*>([^<]+)</g;
    let capMatch;
    while ((capMatch = capRegex.exec(item)) !== null) {
      capabilities.push(capMatch[1].trim().toLowerCase());
    }

    // Extract sizes (8b, 70b, etc.)
    const sizes: string[] = [];
    const sizeRegex = /x-test-size[^>]*>([^<]+)</g;
    let sizeMatch;
    while ((sizeMatch = sizeRegex.exec(item)) !== null) {
      sizes.push(sizeMatch[1].trim());
    }

    // Extract description
    const descMatch = item.match(/<p class="max-w-lg[^"]*">([^<]+)</);
    const description = descMatch ? descMatch[1].trim() : "";

    models.push({ name, description, capabilities, sizes });
  }

  return models;
}

async function fetchOllamaLibraryModels(): Promise<OllamaLibraryModel[]> {
  const OLLAMA_LIBRARY_URL = "https://ollama.com/library";

  try {
    const response = await fetch(OLLAMA_LIBRARY_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Ollama library: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    return parseModelsFromHtml(html);
  } catch (error) {
    console.error("Error fetching Ollama library models:", error);
    return [];
  }
}

export async function getOllamaModelsList(): Promise<ModelPackage[]> {
  const models: { [key: string]: ModelPackage } = {};

  const libraryModels = await fetchOllamaLibraryModels();

  libraryModels.forEach((model: OllamaLibraryModel) => {
    // Skip vision, audio, and embedding models
    const hasExcludedCapability = model.capabilities.some((cap) =>
      EXCLUDED_CAPABILITIES.includes(cap),
    );
    if (hasExcludedCapability) {
      return;
    }

    // Deduplicate by model name
    if (Object.prototype.hasOwnProperty.call(models, model.name)) {
      return;
    }

    try {
      models[model.name] = convertOllamaModelToPackage(model);
    } catch (error) {
      console.error(`Failed to convert Ollama model ${model.name}:`, error);
    }
  });

  return Object.values(models);
}
