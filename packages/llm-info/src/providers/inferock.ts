import { ModelProvider } from "../types.js";

export const Inferock: ModelProvider = {
  models: [
    {
      model: "dane",
      displayName: "Dane",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      description:
        "Hybrid frontier-class reasoning model by Inferock with a 1M context window and tool calling.",
      regex: /^dane$/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "inferock",
  displayName: "Inferock",
};
