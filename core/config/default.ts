import {
  ContextProviderWithParams,
  ModelDescription,
  SerializedContinueConfig,
  SlashCommandDescription,
} from "../";

export const FREE_TRIAL_MODELS: ModelDescription[] = [
  {
    title: "Claude 3.5 Sonnet (Free Trial)",
    provider: "free-trial",
    model: "claude-3-5-sonnet-latest",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "GPT-4o (Free Trial)",
    provider: "free-trial",
    model: "gpt-4o",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "Llama3.1 70b (Free Trial)",
    provider: "free-trial",
    model: "llama3.1-70b",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
  {
    title: "Codestral (Free Trial)",
    provider: "free-trial",
    model: "codestral-latest",
    systemMessage:
      "You are an expert software developer. You give helpful and concise responses.",
  },
];

export const defaultContextProvidersVsCode: ContextProviderWithParams[] = [
  { name: "code", params: {} },
  { name: "docs", params: {} },
  { name: "diff", params: {} },
  { name: "terminal", params: {} },
  { name: "problems", params: {} },
  { name: "folder", params: {} },
  { name: "codebase", params: {} },
];

export const defaultContextProvidersJetBrains: ContextProviderWithParams[] = [
  { name: "diff", params: {} },
  { name: "folder", params: {} },
  { name: "codebase", params: {} },
];

export const defaultSlashCommandsVscode: SlashCommandDescription[] = [
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
  {
    name: "cmd",
    description: "Generate a shell command",
  },
  {
    name: "commit",
    description: "Generate a git commit message",
  },
];

export const defaultSlashCommandsJetBrains = [
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
  {
    name: "commit",
    description: "Generate a git commit message",
  },
];

export const defaultConfig: SerializedContinueConfig = {
  models: [],
  contextProviders: defaultContextProvidersVsCode,
  slashCommands: defaultSlashCommandsVscode,
  data: [],
};

export const defaultOverrideConfig: Partial<SerializedContinueConfig> = {};

export const defaultConfigJetBrains: SerializedContinueConfig = {
  models: [],
  contextProviders: defaultContextProvidersJetBrains,
  slashCommands: defaultSlashCommandsJetBrains,
  data: [],
};

const DEFAULT_CONTEXT_LENGTH = 16384;

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

const defaultConfigGranite: SerializedContinueConfig = {
  models: [],
  embeddingsProvider: {
    provider: "ollama",
    model: "nomic-embed-text:latest",
  },
  contextProviders: defaultContextProvidersVsCode,
  slashCommands: defaultSlashCommandsVscode,
};

export const defaultConfigGraniteSmall: SerializedContinueConfig = {
  ...defaultConfigGranite,
  models: [DEFAULT_MODEL_GRANITE_SMALL],
  tabAutocompleteModel: DEFAULT_MODEL_GRANITE_SMALL,
};

export const defaultConfigGraniteLarge: SerializedContinueConfig = {
  ...defaultConfigGranite,
  models: [DEFAULT_MODEL_GRANITE_LARGE],
  tabAutocompleteModel: DEFAULT_MODEL_GRANITE_LARGE,
};
