import {
  ContextProviderWithParams,
  SerializedContinueConfig,
} from "../index.js";

export const defaultConfig: SerializedContinueConfig = {
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
