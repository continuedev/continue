import { ContextProviderWithParams, SerializedContinueConfig } from "..";

export const defaultConfig: SerializedContinueConfig = {
  models: [
    {
      title: "Claude 3 Sonnet (Free Trial)",
      provider: "free-trial",
      model: "claude-3-sonnet-20240229",
    },
    {
      title: "GPT-4 Turbo (Free Trial)",
      provider: "free-trial",
      model: "gpt-4-turbo",
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
  customCommands: [
    {
      name: "test",
      prompt:
        "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      description: "Write unit tests for highlighted code",
    },
  ],
  tabAutocompleteModel: {
    title: "Starcoder2 3b",
    provider: "ollama",
    model: "starcoder2:3b",
  },
};

export const defaultConfigJetBrains: SerializedContinueConfig = {
  models: [
    {
      title: "Claude 3 Sonnet (Free Trial)",
      provider: "free-trial",
      model: "claude-3-sonnet-20240229",
    },
    {
      title: "GPT-4 Turbo (Free Trial)",
      provider: "free-trial",
      model: "gpt-4-turbo",
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
  customCommands: [
    {
      name: "test",
      prompt:
        "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      description: "Write unit tests for highlighted code",
    },
  ],
  tabAutocompleteModel: {
    title: "Starcoder2 3b",
    provider: "ollama",
    model: "starcoder2:3b",
  },
};

export const defaultSlashCommandsVscode = [
  {
    name: "edit",
    description: "Edit selected code",
  },
  {
    name: "comment",
    description: "Write comments for the selected code",
  },
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
  {
    name: "cmd",
    description: "Generate a shell command",
  },
];

export const defaultSlashCommandsJetBrains = [
  {
    name: "edit",
    description: "Edit selected code",
  },
  {
    name: "comment",
    description: "Write comments for the selected code",
  },
  {
    name: "share",
    description: "Export the current chat session to markdown",
  },
];

export const defaultContextProvidersVsCode: ContextProviderWithParams[] = [
  { name: "code", params: {} },
  { name: "docs", params: {} },
  { name: "diff", params: {} },
  { name: "open", params: {} },
  { name: "terminal", params: {} },
  { name: "problems", params: {} },
  { name: "folder", params: {} },
  { name: "codebase", params: {} },
];

export const defaultContextProvidersJetBrains: ContextProviderWithParams[] = [
  { name: "open", params: {} },
];
