import { ConfigYaml } from "@continuedev/config-yaml";

export const LOCAL_ONBOARDING_PROVIDER_TITLE = "Ollama";
export const LOCAL_ONBOARDING_FIM_MODEL = "qwen2.5-coder:1.5b-base";
export const LOCAL_ONBOARDING_FIM_TITLE = "Qwen2.5-Coder 1.5B";
export const LOCAL_ONBOARDING_CHAT_MODEL = "llama3.1:8b";
export const LOCAL_ONBOARDING_CHAT_TITLE = "Llama 3.1 8B";
export const LOCAL_ONBOARDING_EMBEDDINGS_MODEL = "nomic-embed-text:latest";
export const LOCAL_ONBOARDING_EMBEDDINGS_TITLE = "Nomic Embed";

type OnboardingModel = NonNullable<ConfigYaml["models"]>[number];

const GATEWAY_ONBOARDING_MODELS = (apiKey: string): OnboardingModel[] => [
  {
    name: "Claude Sonnet 4.6 (Gateway)",
    provider: "vercel-ai-gateway",
    model: "anthropic/claude-sonnet-4.6",
    apiKey,
    roles: ["chat", "edit", "apply", "summarize", "subagent"],
    defaultCompletionOptions: { contextLength: 200000, maxTokens: 8192 },
    capabilities: ["tool_use", "image_input"],
  },
  {
    name: "GPT-4.1 mini Autocomplete (Gateway)",
    provider: "vercel-ai-gateway",
    model: "openai/gpt-4.1-mini",
    apiKey,
    roles: ["autocomplete"],
    defaultCompletionOptions: { contextLength: 32000, maxTokens: 256 },
  },
  {
    name: "Embeddings (Gateway)",
    provider: "vercel-ai-gateway",
    model: "openai/text-embedding-3-small",
    apiKey,
    roles: ["embed"],
    embedOptions: { maxChunkSize: 512, maxBatchSize: 64 },
  },
];

/**
 * We set the "best" chat + autocopmlete models by default
 * whenever a user doesn't have a config.json
 */
export function setupBestConfig(config: ConfigYaml): ConfigYaml {
  return {
    ...config,
    models: config.models,
  };
}

export function setupLocalConfig(_config: ConfigYaml): ConfigYaml {
  throw new Error(
    "Local model providers are disabled. Connect a Vercel AI Gateway API key instead.",
  );
}

export function setupQuickstartConfig(config: ConfigYaml): ConfigYaml {
  return config;
}

export function setupProviderConfig(
  config: ConfigYaml,
  provider: string,
  apiKey: string,
): ConfigYaml {
  if (provider !== "vercel-ai-gateway")
    throw new Error("Only Vercel AI Gateway is supported.");
  if (!apiKey.trim())
    throw new Error("A Vercel AI Gateway API key is required.");
  const newModels = GATEWAY_ONBOARDING_MODELS(apiKey.trim());

  const existingModels = (config.models ?? []).filter(
    (model) => "provider" in model && model.provider === "vercel-ai-gateway",
  );

  const isSameModel = (m: OnboardingModel, n: OnboardingModel) =>
    "provider" in m &&
    "provider" in n &&
    m.provider === n.provider &&
    m.model === n.model;

  // Update API key on existing models; add new entries for any missing models
  const updatedModels = existingModels.map((m) => {
    const match = newModels.find((n) => isSameModel(m, n));
    return match ? { ...m, apiKey } : m;
  });
  const modelsToAdd = newModels.filter(
    (n) => !existingModels.some((m) => isSameModel(m, n)),
  );

  return { ...config, models: [...updatedModels, ...modelsToAdd] };
}
