import { SerializedContinueConfig } from "../index.js";

export const TRIAL_FIM_MODEL = "codestral-latest";

export function setupOptimizedMode(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      // {
      //   title: "Codestral (Free Trial)",
      //   provider: "free-trial",
      //   model: "codestral",
      // },
      {
        title: "GPT-4o (Free Trial)",
        provider: "free-trial",
        model: "gpt-4o",
        systemMessage:
          "You are an expert software developer. You give helpful and concise responses.",
      },
      {
        title: "Llama3 70b (Free Trial)",
        provider: "free-trial",
        model: "llama3-70b",
        systemMessage:
          "You are an expert software developer. You give helpful and concise responses. Whenever you write a code block you include the language after the opening ticks.",
      },
      {
        title: "Claude 3 Sonnet (Free Trial)",
        provider: "free-trial",
        model: "claude-3-sonnet-20240229",
      },
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

export function setupOptimizedExistingUserMode(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
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

export function setupLocalMode(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      {
        title: "Llama 3",
        provider: "ollama",
        model: "llama3",
      },
      {
        title: "Ollama",
        provider: "ollama",
        model: "AUTODETECT",
      },
      ...config.models.filter((model) => model.provider !== "free-trial"),
    ],
    tabAutocompleteModel: {
      title: "Starcoder 3b",
      provider: "ollama",
      model: "starcoder2:3b",
    },
    embeddingsProvider: {
      provider: "transformers.js",
    },
    reranker: undefined,
  };
}

export function setupLocalAfterFreeTrial(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      {
        title: "Llama 3",
        provider: "ollama",
        model: "llama3",
      },
      {
        title: "Ollama",
        provider: "ollama",
        model: "AUTODETECT",
      },
      ...config.models.filter((model) => model.provider !== "free-trial"),
    ],
  };
}
