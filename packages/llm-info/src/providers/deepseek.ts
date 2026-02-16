import { ModelProvider } from "../types.js";

export const DeepSeek: ModelProvider = {
  models: [
    {
      model: "deepseek-chat",
      displayName: "DeepSeek Chat",
      contextLength: 131072,
      maxCompletionTokens: 8192,
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-fim-beta",
      displayName: "DeepSeek FIM Beta",
      contextLength: 131072,
      maxCompletionTokens: 8192,
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-reasoner",
      displayName: "DeepSeek Reasoner",
      contextLength: 131072,
      maxCompletionTokens: 65535,
      recommendedFor: ["chat"],
    },
  ],
  id: "deepseek",
  displayName: "DeepSeek",
};
