import { LLMClasses, llmFromProviderAndOptions } from "./llms/index.js";

export interface FetchedModel {
  name: string;
  modelId?: string;
  description?: string;
  icon?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
  /** Continue provider that runs the model when it is not the one the picker belongs to. */
  provider?: string;
  apiBase?: string;
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

// DotHoosh serves its public catalog without a key, so the picker fills before a key exists.
// The Iran-hosted API is not reachable from outside Iran; this mirror relays the same catalog.
const DOTHOOSH_MIRROR_URL = "https://www.dothoosh.com/gateway";
const DOTHOOSH_OPENAI_LISTING = `${DOTHOOSH_MIRROR_URL}/v1/models`;
const DOTHOOSH_ANTHROPIC_LISTING = `${DOTHOOSH_MIRROR_URL}/anthropic/v1/models`;
// Where the Anthropic provider reaches Claude on the Iran-hosted API.
const DOTHOOSH_ANTHROPIC_API_BASE =
  "https://gateway.dothoosh.com/anthropic/v1/";
const DOTHOOSH_FETCH_TIMEOUT_MS = 10_000;

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;

function dotHooshEntries(body: any): any[] | undefined {
  if (!body?.data || !Array.isArray(body.data)) {
    return undefined;
  }
  // One damaged entry (null, a bare string, a numeric id) must not empty the whole list.
  return body.data.filter(
    (m: any) =>
      m && typeof m === "object" && typeof m.id === "string" && m.id.trim(),
  );
}

async function fetchDotHooshListing(url: string): Promise<any[] | undefined> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DOTHOOSH_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch DotHoosh models: ${response.status}`);
    }
    return dotHooshEntries(await response.json());
  } catch (error) {
    console.error("Error fetching DotHoosh models:", error);
    return undefined;
  }
}

function toDotHooshModel(m: any, anthropicOnly: boolean): FetchedModel {
  const nameOf = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : undefined;
  return {
    name: nameOf(m.display_name) ?? nameOf(m.name) ?? m.id,
    modelId: m.id,
    icon: "dothoosh.png",
    contextLength:
      positiveNumber(m.top_provider?.context_length) ??
      positiveNumber(m.context_length),
    maxTokens:
      positiveNumber(m.top_provider?.max_completion_tokens) ??
      positiveNumber(m.max_output_tokens),
    supportsTools:
      Array.isArray(m.supported_parameters) &&
      m.supported_parameters.includes("tools"),
    ...(anthropicOnly
      ? { provider: "anthropic", apiBase: DOTHOOSH_ANTHROPIC_API_BASE }
      : {}),
  };
}

/**
 * Both public listings. A model on the OpenAI listing runs on Chat Completions (DeepSeek is on
 * both); one served only on the Anthropic listing (Claude) runs on the anthropic provider. A
 * failing listing never drops the other one.
 */
export async function fetchDotHooshModels(): Promise<FetchedModel[]> {
  const [openai, anthropic] = await Promise.all([
    fetchDotHooshListing(DOTHOOSH_OPENAI_LISTING),
    fetchDotHooshListing(DOTHOOSH_ANTHROPIC_LISTING),
  ]);

  const onChat = new Set((openai ?? []).map((m) => m.id));
  return [
    ...(openai ?? []).map((m) => toDotHooshModel(m, false)),
    ...(anthropic ?? [])
      .filter((m) => !onChat.has(m.id))
      .map((m) => toDotHooshModel(m, true)),
  ];
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
    case "dothoosh":
      return fetchDotHooshModels();
    case "anthropic":
      return fetchAnthropicModels(apiKey);
    case "gemini":
      return fetchGeminiModels(apiKey, apiBase);
    default:
      return fetchProviderModelsViaListModels(provider, apiKey, apiBase);
  }
}
