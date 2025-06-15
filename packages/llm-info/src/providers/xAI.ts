import { ModelProvider } from "../types.js";

export const xAI: ModelProvider = {
  models: [
    {
      model: "grok-beta",
      displayName: "Grok Beta",
      contextLength: 128000,
      recommendedFor: ["chat"],
    },
  ],
  id: "xAI",
  displayName: "xAI",
};
