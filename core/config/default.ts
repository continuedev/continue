import {
  AssistantUnrolled,
  ConfigYaml,
  ModelConfig,
} from "@continuedev/config-yaml";

export const defaultContextProvidersVsCode = [
  { provider: "code" },
  { provider: "docs" },
  { provider: "diff" },
  { provider: "terminal" },
  { provider: "problems" },
  { provider: "folder" },
  { provider: "codebase" },
];

export const defaultContextProvidersJetBrains = [
  { provider: "diff" },
  { provider: "folder" },
  { provider: "codebase" },
];

export const defaultConfig: ConfigYaml = {
  name: "Local Assistant",
  version: "1.0.0",
  schema: "v1",
  models: [],
  context: defaultContextProvidersVsCode,
};

export const defaultConfigJetBrains: ConfigYaml = {
  name: "Local Assistant",
  version: "1.0.0",
  schema: "v1",
  models: [],
  context: defaultContextProvidersJetBrains,
};

const DEFAULT_CONTEXT_LENGTH = 8192;

const BASE_GRANITE_CONFIG: Partial<ModelConfig> = {
  defaultCompletionOptions: {
    contextLength: DEFAULT_CONTEXT_LENGTH,
    maxTokens: DEFAULT_CONTEXT_LENGTH / 4,
    temperature: 0,
  },
  roles: ["apply", "chat", "edit", "summarize"],
};

export const DEFAULT_MODEL_GRANITE_SMALL: ModelConfig = {
  name: "granite3.3:2b",
  provider: "ollama",
  model: "granite3.3:2b",
  ...BASE_GRANITE_CONFIG,
};

export const DEFAULT_MODEL_GRANITE_LARGE: ModelConfig = {
  name: "granite3.3:8b",
  provider: "ollama",
  model: "granite3.3:8b",
  ...BASE_GRANITE_CONFIG,
};

// We optimize for speed over quality by using the 2b-base
// model which is *almost* as good as the 8b-instruct model,
// though not as good as the 8b-base model.
export const DEFAULT_GRANITE_COMPLETION_MODEL: ModelConfig = {
  ...BASE_GRANITE_CONFIG,
  name: "granite3.3:2b-base",
  provider: "ollama",
  model: "ibm/granite3.3:2b-base",
  defaultCompletionOptions: {
    ...BASE_GRANITE_CONFIG.defaultCompletionOptions,
    // This needs to be bigger than maxPromptTokens (1024) + maxTokens (100)
    contextLength: 1536,
    maxTokens: 100,
  },
  roles: ["autocomplete"],
};

export const DEFAULT_GRANITE_EMBEDDING_MODEL: ModelConfig = {
  name: "nomic-embed-text",
  provider: "ollama",
  model: "nomic-embed-text:latest",
  roles: ["embed"],
};

export const DEFAULT_GRANITE_MODEL_IDS_LARGE = [
  DEFAULT_MODEL_GRANITE_LARGE.model,
  DEFAULT_GRANITE_COMPLETION_MODEL.model,
  DEFAULT_GRANITE_EMBEDDING_MODEL.model,
];

export const DEFAULT_GRANITE_MODEL_IDS_SMALL = [
  DEFAULT_MODEL_GRANITE_SMALL.model,
  DEFAULT_GRANITE_COMPLETION_MODEL.model,
  DEFAULT_GRANITE_EMBEDDING_MODEL.model,
];

export const defaultConfigGraniteLarge: Required<
  Pick<AssistantUnrolled, "models" | "context">
> = {
  models: [
    DEFAULT_MODEL_GRANITE_LARGE,
    DEFAULT_GRANITE_COMPLETION_MODEL,
    DEFAULT_GRANITE_EMBEDDING_MODEL,
  ],
  context: defaultContextProvidersVsCode,
};

export const defaultConfigGraniteSmall: Required<
  Pick<AssistantUnrolled, "models" | "context">
> = {
  models: [
    DEFAULT_MODEL_GRANITE_SMALL,
    DEFAULT_GRANITE_COMPLETION_MODEL,
    DEFAULT_GRANITE_EMBEDDING_MODEL,
  ],
  context: defaultContextProvidersVsCode,
};
