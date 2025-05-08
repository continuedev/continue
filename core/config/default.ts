import { ConfigYaml } from "@continuedev/config-yaml";

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
  models: [
    {
      name: "GPT-4.1",
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "oSTtwkdRm3kNaE8+tVB+CfhVMyqu", //TODO: Expire this key
      apiBase: "https://api.portkey.ai/v1",
      capabilities: [
        "tool_use",
        "image_input"
      ],
      roles: [
        "chat",
        "edit"
      ]
    },
    {
      name: "GPT-4o-mini",
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "oSTtwkdRm3kNaE8+tVB+CfhVMyqu",
      apiBase: "https://api.portkey.ai/v1",
      roles: [
        "autocomplete",
        "apply"
      ]
    },
    {
      name: "Claude-3.7-sonnet",
      provider: "openai",
      model: "claude-3-7-sonnet",
      apiKey: "oSTtwkdRm3kNaE8+tVB+CfhVMyqu",
      apiBase: "https://api.portkey.ai/v1",
      capabilities: [
        "tool_use",
        "image_input"
      ],
      roles: [
        "chat",
        "edit"
      ]
    },
    {
      name: "llama-3.1-70b-instruct",
      provider: "openai",
      model: "llama-3.1-70b-instruct",
      apiKey: "oSTtwkdRm3kNaE8+tVB+CfhVMyqu",
      apiBase: "https://api.portkey.ai/v1",
      capabilities: [
        "tool_use",
        "image_input"
      ],
      roles: [
        "chat",
        "edit"
      ]
    }
  ],
  context: defaultContextProvidersVsCode,
};

export const defaultConfigJetBrains: ConfigYaml = {
  name: "Local Assistant",
  version: "1.0.0",
  schema: "v1",
  models: [],
  context: defaultContextProvidersJetBrains,
};
