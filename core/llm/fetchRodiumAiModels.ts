const RODIUMAI_DEFAULT_API_BASE = "https://api.rodiumai.io/v1/";

interface RodiumAiFetchedModel {
  name: string;
  modelId?: string;
  description?: string;
  icon?: string;
  contextLength?: number;
  maxTokens?: number;
  supportsTools?: boolean;
}

const RODIUMAI_PROVIDER_ICON_MAP: Record<string, string> = {
  openai: "openai.png",
  anthropic: "anthropic.png",
  google: "gemini.png",
  gemini: "gemini.png",
  deepseek: "deepseek.png",
  mistral: "mistral.png",
  meta: "meta.png",
  moonshot: "moonshot.png",
  xai: "xAI.png",
  cohere: "cohere.png",
};

export function getRodiumAiModelIcon(
  modelId: string,
  providerSlug?: string,
): string {
  if (providerSlug && RODIUMAI_PROVIDER_ICON_MAP[providerSlug]) {
    return RODIUMAI_PROVIDER_ICON_MAP[providerSlug];
  }

  const lower = modelId.toLowerCase();
  if (lower.includes("claude")) {
    return "anthropic.png";
  }
  if (lower.includes("gpt") || lower.startsWith("openai/")) {
    return "openai.png";
  }
  if (lower.includes("gemini") || lower.includes("gemma")) {
    return "gemini.png";
  }
  if (lower.includes("deepseek")) {
    return "deepseek.png";
  }
  if (lower.includes("mistral")) {
    return "mistral.png";
  }

  return "rodium.svg";
}

export async function fetchRodiumAiModels(
  apiKey?: string,
  apiBase?: string,
): Promise<RodiumAiFetchedModel[]> {
  try {
    const base = apiBase || RODIUMAI_DEFAULT_API_BASE;
    const url = new URL("models", base);
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch RodiumAi models: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data
      .filter((m: any) => m.id)
      .map((m: any) => {
        const providerSlug: string | undefined = m.rodiumai_provider?.slug;
        const capabilities = m.rodiumai_capabilities ?? {};

        return {
          name: m.rodiumai_display_name ?? m.id,
          modelId: m.id,
          description: m.rodiumai_description,
          icon: getRodiumAiModelIcon(m.id, providerSlug),
          contextLength: capabilities.context_window,
          maxTokens: capabilities.max_output_tokens,
          supportsTools: capabilities.supports_tools,
        };
      });
  } catch (error) {
    console.error("Error fetching RodiumAi models:", error);
    return [];
  }
}
