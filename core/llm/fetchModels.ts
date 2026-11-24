import { LLMClasses, llmFromProviderAndOptions } from "./llms/index.js";

export interface FetchedModel {
  name: string;
  modelId?: string;
  description?: string;
  icon?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
}

const OLLAMA_EXCLUDED_CAPABILITIES = ["vision", "audio", "embedding"];

const OLLAMA_ICON_MAP: Record<string, string> = {
  llama: "meta.png",
  codellama: "meta.png",
  "phind-codellama": "meta.png",
  deepseek: "deepseek.png",
  deepcoder: "deepseek.png",
  deepscaler: "deepseek.png",
  mistral: "mistral.png",
  mixtral: "mistral.png",
  codestral: "mistral.png",
  devstral: "mistral.png",
  magistral: "mistral.png",
  mathstral: "mistral.png",
  ministral: "mistral.png",
  gemma: "gemini.png",
  codegemma: "gemini.png",
  "gemini-": "gemini.png",
  qwen: "qwen.png",
  codeqwen: "qwen.png",
  qwq: "qwen.png",
  command: "cohere.png",
  aya: "cohere.png",
  granite: "ibm.png",
  nemotron: "nvidia.png",
  kimi: "moonshot.png",
  glm: "zai.svg",
  codegeex: "zai.svg",
  wizardcoder: "wizardlm.png",
  wizardlm: "wizardlm.png",
  "wizard-": "wizardlm.png",
  olmo: "allenai.png",
  tulu: "allenai.png",
  firefunction: "fireworks.png",
  "gpt-oss": "openai.png",
};

function getOllamaIcon(modelName: string): string {
  if (OLLAMA_ICON_MAP[modelName]) {
    return OLLAMA_ICON_MAP[modelName];
  }
  let bestMatch = "";
  for (const prefix of Object.keys(OLLAMA_ICON_MAP)) {
    if (modelName.startsWith(prefix) && prefix.length > bestMatch.length) {
      bestMatch = prefix;
    }
  }
  return bestMatch ? OLLAMA_ICON_MAP[bestMatch] : "ollama.png";
}

async function fetchOllamaModels(): Promise<FetchedModel[]> {
  try {
    const response = await fetch("https://ollama.com/library");
    if (!response.ok) {
      throw new Error(`Failed to fetch Ollama library: ${response.status}`);
    }

    const html = await response.text();
    const models: FetchedModel[] = [];
    const items = html.split("x-test-model class=");
    const seen = new Set<string>();

    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const nameMatch = item.match(/href="\/library\/([^"]+)"/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      if (seen.has(name)) continue;

      const capabilities: string[] = [];
      const capRegex = /x-test-capability[^>]*>([^<]+)</g;
      let capMatch;
      while ((capMatch = capRegex.exec(item)) !== null) {
        capabilities.push(capMatch[1].trim().toLowerCase());
      }
      if (
        capabilities.some((cap) => OLLAMA_EXCLUDED_CAPABILITIES.includes(cap))
      ) {
        continue;
      }

      const sizes: string[] = [];
      const sizeRegex = /x-test-size[^>]*>([^<]+)</g;
      let sizeMatch;
      while ((sizeMatch = sizeRegex.exec(item)) !== null) {
        sizes.push(sizeMatch[1].trim());
      }

      const descMatch = item.match(/<p class="max-w-lg[^"]*">([^<]+)</);
      const sizeLabel = sizes.length > 0 ? ` (${sizes.join(", ")})` : "";
      const description = descMatch
        ? descMatch[1].trim()
        : `Ollama model: ${name}${sizeLabel}`;

      seen.add(name);
      models.push({
        name,
        description,
        icon: getOllamaIcon(name),
        supportsTools: capabilities.includes("tools"),
      });
    }

    return models;
  } catch (error) {
    console.error("Error fetching Ollama library models:", error);
    return [];
  }
}

async function fetchOpenRouterModels(): Promise<FetchedModel[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenRouter models: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data
      .filter((m: any) => m.id && m.name)
      .map((m: any) => ({
        name: m.name,
        modelId: m.id,
        icon: "openrouter.png",
        contextLength: m.context_length,
        maxTokens: m.top_provider?.max_completion_tokens,
        supportsTools: (m.supported_parameters ?? []).includes("tools"),
      }));
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return [];
  }
}

async function fetchAnthropicModels(apiKey?: string): Promise<FetchedModel[]> {
  const response = await fetch(
    "https://api.anthropic.com/v1/models?limit=100",
    {
      headers: {
        "x-api-key": apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Anthropic models: ${response.status}`);
  }
  const data = await response.json();
  return (data.data ?? []).map((m: any) => ({
    name: m.display_name ?? m.id,
    modelId: m.id,
    icon: "anthropic.png",
    contextLength: m.max_input_tokens,
    maxTokens: m.max_tokens,
    supportsTools: true,
  }));
}

async function fetchGeminiModels(
  apiKey?: string,
  apiBase?: string,
): Promise<FetchedModel[]> {
  const base = apiBase || "https://generativelanguage.googleapis.com/v1beta/";
  const url = new URL("models", base);
  url.searchParams.set("key", apiKey ?? "");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Gemini models: ${response.status}`);
  }
  const data = await response.json();
  return (data.models ?? [])
    .filter((m: any) => {
      const id: string = m.name?.replace("models/", "") ?? "";
      const methods: string[] = m.supportedGenerationMethods ?? [];
      return (
        !id.startsWith("gemini-2.0") &&
        !id.startsWith("gemma-") && // Gemma models are supported through Ollama, not the Gemini API
        !id.startsWith("nano-banana") &&
        !id.startsWith("lyria") &&
        methods.includes("generateContent") &&
        !methods.includes("embedContent") &&
        !methods.includes("predict") &&
        !methods.includes("predictLongRunning") &&
        !methods.includes("bidiGenerateContent") &&
        !id.includes("tts") &&
        !id.includes("image") &&
        !id.includes("robotics") &&
        !id.includes("computer-use")
      );
    })
    .map((m: any) => ({
      name: m.displayName ?? m.name?.replace("models/", ""),
      modelId: m.name?.replace("models/", ""),
      icon: "gemini.png",
      contextLength: m.inputTokenLimit,
      maxTokens: m.outputTokenLimit,
      supportsTools: true,
    }));
}

async function fetchProviderModelsViaListModels(
  provider: string,
  apiKey?: string,
  apiBase?: string,
): Promise<FetchedModel[]> {
  try {
    const cls = LLMClasses.find((llm) => llm.providerName === provider);
    const defaultApiBase = cls?.defaultOptions?.apiBase;

    const llm = llmFromProviderAndOptions(provider, {
      apiKey,
      apiBase: apiBase || defaultApiBase,
      model: "",
    });
    const modelIds = await llm.listModels();
    return modelIds.map((id) => ({ name: id }));
  } catch (error: any) {
    throw new Error(
      `Failed to fetch models for ${provider}: ${error?.message ?? error}`,
    );
  }
}

export async function fetchModels(
  provider: string,
  apiKey?: string,
  apiBase?: string,
): Promise<FetchedModel[]> {
  switch (provider) {
    case "ollama":
      return fetchOllamaModels();
    case "openrouter":
      return fetchOpenRouterModels();
    case "anthropic":
      return fetchAnthropicModels(apiKey);
    case "gemini":
      return fetchGeminiModels(apiKey, apiBase);
    default:
      return fetchProviderModelsViaListModels(provider, apiKey, apiBase);
  }
}
