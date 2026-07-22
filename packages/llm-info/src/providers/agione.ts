import { ModelProvider } from "../types.js";

export const AGIone: ModelProvider = {
  id: "agione",
  displayName: "AGIone",
  models: [
    {
      model: "openai/GPT-5.5/c6fbe",
      displayName: "GPT-5.5",
      contextLength: 128000,
      description: "GPT-5.5 via AGIone's OpenAI-compatible API.",
      recommendedFor: ["chat"],
    },
    {
      model: "anthropic/Claude-opus-4.7/a4d5d",
      displayName: "Claude Opus 4.7",
      contextLength: 200000,
      description: "Claude Opus 4.7 via AGIone's OpenAI-compatible API.",
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek/deepseek-v3.2/0000n",
      displayName: "DeepSeek V3.2",
      contextLength: 128000,
      description: "DeepSeek V3.2 via AGIone's OpenAI-compatible API.",
      recommendedFor: ["chat"],
    },
  ],
};
