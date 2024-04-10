import { SerializedContinueConfig } from "..";

export function setupOptimizedMode(
  config: SerializedContinueConfig,
): SerializedContinueConfig {
  return {
    ...config,
    models: [
      {
        title: "Claude 3 Sonnet (Free Trial)",
        provider: "free-trial",
        model: "claude-3-sonnet-20240229",
      },
      {
        title: "GPT-4 Vision (Free Trial)",
        provider: "free-trial",
        model: "gpt-4-vision-preview",
      },
      {
        title: "GPT-3.5-Turbo (Free Trial)",
        provider: "free-trial",
        model: "gpt-3.5-turbo",
      },
      {
        title: "Gemini Pro (Free Trial)",
        provider: "free-trial",
        model: "gemini-pro",
      },
      {
        title: "Mixtral (Free Trial)",
        provider: "free-trial",
        model: "mistral-8x7b",
      },
    ],
    tabAutocompleteModel: {
      title: "Tab Autocomplete",
      provider: "free-trial",
      model: "starcoder-7b",
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
      model: "starcoder-7b",
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
        title: "Ollama",
        provider: "ollama",
        model: "AUTODETECT",
      },
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
