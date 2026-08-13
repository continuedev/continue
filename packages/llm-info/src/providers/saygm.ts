import { ModelProvider } from "../types.js";

export const Saygm: ModelProvider = {
  id: "saygm",
  displayName: "SayGM",
  models: [
    {
      model: "gpt-5.4",
      displayName: "GPT-5.4",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.4-mini",
      displayName: "GPT-5.4 Mini",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.4-nano",
      displayName: "GPT-5.4 Nano",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.5",
      displayName: "GPT-5.5",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.6-luna",
      displayName: "GPT-5.6 Luna",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5.6-terra",
      displayName: "GPT-5.6 Terra",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "o3",
      displayName: "o3",
      contextLength: 1000000,
      maxCompletionTokens: 100000,
      recommendedFor: ["chat"],
    },
    {
      model: "o4-mini",
      displayName: "o4 Mini",
      contextLength: 1000000,
      maxCompletionTokens: 100000,
      recommendedFor: ["chat"],
    },
  ],
};
