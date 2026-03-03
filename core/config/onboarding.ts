import { ConfigYaml } from "@continuedev/config-yaml";

export const LOCAL_ONBOARDING_PROVIDER_TITLE = "Ollama";
export const LOCAL_ONBOARDING_FIM_MODEL = "qwen2.5-coder:1.5b-base";
export const LOCAL_ONBOARDING_FIM_TITLE = "Qwen2.5-Coder 1.5B";
export const LOCAL_ONBOARDING_CHAT_MODEL = "llama3.1:8b";
export const LOCAL_ONBOARDING_CHAT_TITLE = "Llama 3.1 8B";
export const LOCAL_ONBOARDING_EMBEDDINGS_MODEL = "nomic-embed-text:latest";
export const LOCAL_ONBOARDING_EMBEDDINGS_TITLE = "Nomic Embed";

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

const DEEPSEEK_MODEL_CONFIG = {
  slugs: [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-reasoner",
    "deepseek/deepseek-fim-beta", // autocomplete not very useful with large delay, but configured with autocomplete role
  ],
  apiKeyInputName: "DEEPSEEK_API_KEY",
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

export function setupLocalConfig(config: ConfigYaml): ConfigYaml {
  return {
    ...config,
    models: [
      {
        name: LOCAL_ONBOARDING_CHAT_TITLE,
        provider: "ollama",
        model: LOCAL_ONBOARDING_CHAT_MODEL,
        roles: ["chat", "edit", "apply"],
      },
      {
        name: LOCAL_ONBOARDING_FIM_TITLE,
        provider: "ollama",
        model: LOCAL_ONBOARDING_FIM_MODEL,
        roles: ["autocomplete"],
      },
      {
        name: LOCAL_ONBOARDING_EMBEDDINGS_TITLE,
        provider: "ollama",
        model: LOCAL_ONBOARDING_EMBEDDINGS_MODEL,
        roles: ["embed"],
      },
      ...(config.models ?? []),
    ],
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
    case "deepseek":
      newModels = DEEPSEEK_MODEL_CONFIG.slugs.map((slug) => {
        const modelObj: any = {
          uses: slug,
          with: {
            [DEEPSEEK_MODEL_CONFIG.apiKeyInputName]: apiKey,
          },
        };
        // Add overrides based on model slug
        if (slug === "deepseek/deepseek-fim-beta") {
          modelObj.override = {
            apiBase: "https://api.deepseek.com/beta",
            defaultCompletionOptions: {
              contextLength: 131072,
              maxTokens: 8192,
            },
            capabilities: [], // FIM Beta doesn't support tools
          };
          modelObj.roles = [
            "chat",
            "autocomplete",
            "edit",
            "apply",
            "summarize",
            "subagent",
          ];
        } else if (slug === "deepseek/deepseek-chat") {
          modelObj.override = {
            apiBase: "https://api.deepseek.com/",
            defaultCompletionOptions: {
              contextLength: 131072,
              maxTokens: 8192,
            },
            capabilities: ["tool_use"],
          };
          modelObj.roles = ["chat", "edit", "apply", "summarize", "subagent"];
        } else {
          // deepseek/deepseek-reasoner
          modelObj.override = {
            apiBase: "https://api.deepseek.com/",
            defaultCompletionOptions: {
              contextLength: 131072,
              maxTokens: 65535,
            },
            capabilities: ["tool_use"],
          };
          modelObj.roles = ["chat", "edit", "apply", "summarize", "subagent"];
        }
        return modelObj;
      });
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return {
    ...config,
    models: [...(config.models ?? []), ...newModels],
  };
}
