import { ConfigYaml } from "@continuedev/config-yaml";
import { ModelDescription } from "..";

export const defaultContextProvidersVsCode: NonNullable<
  ConfigYaml["context"]
>[number][] = [
  { provider: "code" },
  { provider: "docs" },
  { provider: "diff" },
  { provider: "terminal" },
  { provider: "problems" },
  { provider: "folder" },
  { provider: "codebase" },
];

export const defaultContextProvidersJetBrains: NonNullable<
  ConfigYaml["context"]
>[number][] = [
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

const BASE_GRANITE_CONFIG: Partial<ModelDescription> = {
  contextLength: DEFAULT_CONTEXT_LENGTH,
  completionOptions: {
    maxTokens: DEFAULT_CONTEXT_LENGTH / 4,
    temperature: 0,
    topP: 0.9,
    topK: 40,
    presencePenalty: 0.0,
    frequencyPenalty: 0.1,
  },
  systemMessage: `\
You are Granite, an AI language model developed by IBM. \
You are a cautious assistant. You carefully follow instructions. \
You are helpful and harmless and you follow ethical guidelines and promote positive behavior.
`,
};

export const DEFAULT_MODEL_GRANITE_SMALL: ModelDescription = {
  title: "granite3.2:2b",
  provider: "ollama",
  model: "granite3.2:2b",
  ...BASE_GRANITE_CONFIG,
};

export const DEFAULT_MODEL_GRANITE_LARGE: ModelDescription = {
  title: "granite3.2:8b",
  provider: "ollama",
  model: "granite3.2:8b",
  ...BASE_GRANITE_CONFIG,
};
