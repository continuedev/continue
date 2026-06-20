import { ModelProvider } from "../types.js";

export const Chutes: ModelProvider = {
  models: [
    {
      model: "chutes/DeepSeek-V3.2-TEE",
      displayName: "DeepSeek V3.2 TEE",
      contextLength: 65536,
      recommendedFor: ["chat"],
      regex: /DeepSeek-V3\.2-TEE/,
    },
    {
      model: "chutes/Qwen3-32B-TEE",
      displayName: "Qwen3 32B TEE",
      contextLength: 131072,
      recommendedFor: ["chat"],
      regex: /Qwen3-32B-TEE/,
    },
    {
      model: "chutes/Kimi-K2.5-TEE",
      displayName: "Kimi K2.5 TEE",
      contextLength: 262144,
      recommendedFor: ["chat"],
      regex: /Kimi-K2\.5-TEE/,
    },
  ],
  id: "chutes",
  displayName: "Chutes AI",
};
