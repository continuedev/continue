import { ConfigYaml } from "@continuedev/config-yaml";

export const defaultConfig: ConfigYaml = {
  name: "Shihuo Agent",
  version: "1.0.0",
  schema: "v1",
  models: [
    {
      name: "qwen3-coder-plus",
      provider: "openai",
      model: "qwen3-coder-plus",
      apiKey: "sk-xxxx",
      apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      roles: ["chat", "edit", "apply"],
      capabilities: ["tool_use"],
    },
    {
      name: "Qwen2.5-Coder-14B",
      provider: "openai",
      model: "Qwen2.5-Coder-14B",
      apiKey: "dummy",
      apiBase: "http://coder-a100.shizhi-inc.com/v1",
      roles: ["autocomplete"],
      autocompleteOptions: {
        disable: false,
        maxPromptTokens: 1024,
        debounceDelay: 150,
        modelTimeout: 800,
        maxSuffixPercentage: 0.2,
        prefixPercentage: 0.8,
        transform: true,
        onlyMyCode: true,
        useCache: true,
        useImports: true,
        useRecentlyEdited: true,
        useRecentlyOpened: false,
      },
      defaultCompletionOptions: {
        maxTokens: 1024,
      },
    },
  ],
};
