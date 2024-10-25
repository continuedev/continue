import { SerializedContinueConfig } from "../";
import { FREE_TRIAL_MODELS } from "./default";

export const TRIAL_FIM_MODEL = "codestral-latest";
export const ONBOARDING_LOCAL_MODEL_TITLE = "Ollama";
export const LOCAL_ONBOARDING_FIM_MODEL = "starcoder2:3b";
export const LOCAL_ONBOARDING_CHAT_MODEL = "llama3.1:8b";
export const LOCAL_ONBOARDING_CHAT_TITLE = "Llama 3.1 8B";

/**
 * We set the "best" chat + autocopmlete models by default
 * whenever a user doesn't have a config.json
 */
export function setupBestConfig(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: config.models.filter((model) => model.provider !== "free-trial"),
  };
}

export function setupLocalConfig(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      {
        title: LOCAL_ONBOARDING_CHAT_TITLE,
        provider: "ollama",
        model: LOCAL_ONBOARDING_CHAT_MODEL,
      },
      ...config.models.filter((model) => model.provider !== "free-trial"),
    ],
    tabAutocompleteModel: {
      title: "Starcoder 3b",
      provider: "ollama",
      model: LOCAL_ONBOARDING_FIM_MODEL,
    },
    embeddingsProvider: {
      provider: "ollama",
      model: "nomic-embed-text",
    },
  };
}

export function setupQuickstartConfig(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      ...FREE_TRIAL_MODELS,
      ...config.models.filter((model) => model.provider !== "free-trial"),
    ],
    tabAutocompleteModel: {
      title: "Tab Autocomplete",
      provider: "free-trial",
      model: TRIAL_FIM_MODEL,
    },
    embeddingsProvider: {
      provider: "free-trial",
    },
    reranker: {
      name: "free-trial",
    },
  };
}

export function setupLocalConfigAfterFreeTrial(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      {
        title: LOCAL_ONBOARDING_CHAT_TITLE,
        provider: "ollama",
        model: LOCAL_ONBOARDING_CHAT_MODEL,
      },
      {
        title: ONBOARDING_LOCAL_MODEL_TITLE,
        provider: "ollama",
        model: "AUTODETECT",
      },
      ...config.models.filter((model) => model.provider !== "free-trial"),
    ],
  };
}
