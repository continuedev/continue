import { ConfigYaml } from "@continuedev/config-yaml";

export type LocalOnboardingProvider = "ollama" | "lmstudio";

export const DEFAULT_LOCAL_ONBOARDING_PROVIDER: LocalOnboardingProvider =
  "ollama";

type LocalOnboardingModel = {
  name: string;
  provider: LocalOnboardingProvider;
  model: string;
  roles: (
    | "chat"
    | "autocomplete"
    | "embed"
    | "edit"
    | "apply"
    | "summarize"
    | "subagent"
    | "rerank"
  )[];
};

type LocalOnboardingConfig = {
  providerTitle: string;
  chatTitle: string;
  chatModel: string;
  autocompleteTitle?: string;
  autocompleteModel?: string;
  embeddingsTitle?: string;
  embeddingsModel?: string;
};

const OLLAMA_LOCAL_ONBOARDING_CONFIG: LocalOnboardingConfig = {
  providerTitle: "Ollama",
  chatTitle: "Llama 3.1 8B",
  chatModel: "llama3.1:8b",
  autocompleteTitle: "Qwen2.5-Coder 1.5B",
  autocompleteModel: "qwen2.5-coder:1.5b-base",
  embeddingsTitle: "Nomic Embed",
  embeddingsModel: "nomic-embed-text:latest",
};

const LMSTUDIO_LOCAL_ONBOARDING_CONFIG: LocalOnboardingConfig = {
  providerTitle: "LM Studio",
  chatTitle: "LM Studio",
  chatModel: "AUTODETECT",
};

export function getLocalOnboardingConfig(
  provider: LocalOnboardingProvider = DEFAULT_LOCAL_ONBOARDING_PROVIDER,
): LocalOnboardingConfig {
  return provider === "lmstudio"
    ? LMSTUDIO_LOCAL_ONBOARDING_CONFIG
    : OLLAMA_LOCAL_ONBOARDING_CONFIG;
}

function dedupeModels(models?: string[]) {
  if (!models?.length) {
    return [];
  }

  return Array.from(
    new Set(models.map((model) => model.trim()).filter(Boolean)),
  );
}

function getPreferredModel(
  models: string[],
  matchers: RegExp[],
  fallback: string,
): string {
  return (
    models.find((model) => matchers.some((matcher) => matcher.test(model))) ??
    fallback
  );
}

function getLmStudioOnboardingModels(
  models?: string[],
): LocalOnboardingModel[] {
  const availableModels = dedupeModels(models);
  const fallbackConfig = getLocalOnboardingConfig("lmstudio");
  const fallbackModel = availableModels[0] ?? fallbackConfig.chatModel;
  const chatModel =
    availableModels.find(
      (model) =>
        [/instruct/i, /chat/i, /assistant/i].some((matcher) =>
          matcher.test(model),
        ) && !/(coder|code|codestral)/i.test(model),
    ) ??
    getPreferredModel(
      availableModels,
      [/instruct/i, /chat/i, /assistant/i],
      fallbackModel,
    );
  const autocompleteModel = getPreferredModel(
    availableModels,
    [/coder/i, /code/i, /codestral/i, /deepseek/i, /qwen/i],
    chatModel,
  );
  const embeddingsModel = getPreferredModel(
    availableModels,
    [/embed/i, /embedding/i, /nomic/i, /bge/i, /\be5\b/i],
    "",
  );

  const localModels: LocalOnboardingModel[] = [
    {
      name: chatModel,
      provider: "lmstudio",
      model: chatModel,
      roles:
        autocompleteModel === chatModel
          ? ["chat", "edit", "apply", "autocomplete"]
          : ["chat", "edit", "apply"],
    },
  ];

  if (autocompleteModel !== chatModel) {
    localModels.push({
      name: autocompleteModel,
      provider: "lmstudio",
      model: autocompleteModel,
      roles: ["autocomplete"],
    });
  }

  if (embeddingsModel && embeddingsModel !== chatModel) {
    localModels.push({
      name: embeddingsModel,
      provider: "lmstudio",
      model: embeddingsModel,
      roles: ["embed"],
    });
  }

  return localModels;
}

export function getLocalOnboardingPrimaryModelTitle(
  provider: LocalOnboardingProvider = DEFAULT_LOCAL_ONBOARDING_PROVIDER,
  availableModels?: string[],
) {
  if (provider === "lmstudio") {
    return getLmStudioOnboardingModels(availableModels)[0]?.name ?? "LM Studio";
  }

  return getLocalOnboardingConfig(provider).chatTitle;
}

const ANTHROPIC_MODEL_CONFIG = {
  slugs: ["anthropic/claude-3-7-sonnet", "anthropic/claude-4-sonnet"],
  apiKeyInputName: "ANTHROPIC_API_KEY",
};
const OPENAI_MODEL_CONFIG = {
  slugs: ["openai/gpt-4.1", "openai/o3", "openai/gpt-4.1-mini"],
  apiKeyInputName: "OPENAI_API_KEY",
};

// TODO: These need updating on the hub
const GEMINI_MODEL_CONFIG = {
  slugs: ["google/gemini-2.5-pro", "google/gemini-2.0-flash"],
  apiKeyInputName: "GEMINI_API_KEY",
};

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

export function setupLocalConfig(
  config: ConfigYaml,
  provider: LocalOnboardingProvider = DEFAULT_LOCAL_ONBOARDING_PROVIDER,
  availableModels?: string[],
): ConfigYaml {
  const onboardingConfig = getLocalOnboardingConfig(provider);
  const localModels: LocalOnboardingModel[] =
    provider === "lmstudio"
      ? getLmStudioOnboardingModels(availableModels)
      : [
          {
            name: onboardingConfig.chatTitle,
            provider: "ollama",
            model: onboardingConfig.chatModel,
            roles: ["chat", "edit", "apply"],
          },
          {
            name: onboardingConfig.autocompleteTitle!,
            provider: "ollama",
            model: onboardingConfig.autocompleteModel!,
            roles: ["autocomplete"],
          },
          {
            name: onboardingConfig.embeddingsTitle!,
            provider: "ollama",
            model: onboardingConfig.embeddingsModel!,
            roles: ["embed"],
          },
        ];

  return {
    ...config,
    models: [...localModels, ...(config.models ?? [])],
  };
}

export function setupQuickstartConfig(config: ConfigYaml): ConfigYaml {
  return config;
}

export function setupProviderConfig(
  config: ConfigYaml,
  provider: string,
  apiKey: string,
): ConfigYaml {
  let newModels;

  switch (provider) {
    case "openai":
      newModels = OPENAI_MODEL_CONFIG.slugs.map((slug) => ({
        uses: slug,
        with: {
          [OPENAI_MODEL_CONFIG.apiKeyInputName]: apiKey,
        },
      }));
      break;
    case "anthropic":
      newModels = ANTHROPIC_MODEL_CONFIG.slugs.map((slug) => ({
        uses: slug,
        with: {
          [ANTHROPIC_MODEL_CONFIG.apiKeyInputName]: apiKey,
        },
      }));
      break;
    case "gemini":
      newModels = GEMINI_MODEL_CONFIG.slugs.map((slug) => ({
        uses: slug,
        with: {
          [GEMINI_MODEL_CONFIG.apiKeyInputName]: apiKey,
        },
      }));
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return {
    ...config,
    models: [...(config.models ?? []), ...newModels],
  };
}
