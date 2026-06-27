import { ModelProvider } from "../types.js";

export const Avian: ModelProvider = {
  models: [
    {
      model: "deepseek/deepseek-v3.2",
      displayName: "DeepSeek V3.2",
      contextLength: 164000,
      recommendedFor: ["chat"],
      regex: /deepseek\/deepseek-v3\.2/,
    },
    {
      model: "moonshotai/kimi-k2.5",
      displayName: "Kimi K2.5",
      contextLength: 131000,
      recommendedFor: ["chat"],
      regex: /moonshotai\/kimi-k2\.5/,
    },
    {
      model: "z-ai/glm-5",
      displayName: "GLM-5",
      contextLength: 131000,
      recommendedFor: ["chat"],
      regex: /z-ai\/glm-5/,
    },
    {
      model: "minimax/minimax-m2.5",
      displayName: "MiniMax M2.5",
      contextLength: 1000000,
      recommendedFor: ["chat"],
      regex: /minimax\/minimax-m2\.5/,
    },
  ],
  id: "avian",
  displayName: "Avian",
};
