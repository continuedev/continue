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

export const DEFAULT_GRANITE_COMPLETION_MODEL_LARGE: ModelConfig = {
  ...DEFAULT_MODEL_GRANITE_LARGE,
  name: DEFAULT_MODEL_GRANITE_LARGE.name + "::autocomplete",
  defaultCompletionOptions: {
    ...DEFAULT_MODEL_GRANITE_LARGE.defaultCompletionOptions,
    maxTokens: 100,
  },
  roles: ["autocomplete"],
};

export const DEFAULT_GRANITE_COMPLETION_MODEL_SMALL: ModelConfig = {
  ...DEFAULT_MODEL_GRANITE_SMALL,
  name: DEFAULT_MODEL_GRANITE_SMALL.name + "::autocomplete",
  defaultCompletionOptions: {
    ...DEFAULT_MODEL_GRANITE_SMALL.defaultCompletionOptions,
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

export const defaultConfigGraniteLarge: Required<
  Pick<AssistantUnrolled, "models" | "context">
> = {
  models: [DEFAULT_MODEL_GRANITE_LARGE, DEFAULT_GRANITE_COMPLETION_MODEL_LARGE, DEFAULT_GRANITE_EMBEDDING_MODEL],
  context: defaultContextProvidersVsCode,
};

export const defaultConfigGraniteSmall: Required<
  Pick<AssistantUnrolled, "models" | "context">
> = {
  models: [DEFAULT_MODEL_GRANITE_SMALL, DEFAULT_GRANITE_COMPLETION_MODEL_SMALL, DEFAULT_GRANITE_EMBEDDING_MODEL],
  context: defaultContextProvidersVsCode,
};
