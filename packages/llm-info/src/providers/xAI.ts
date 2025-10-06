import { ModelProvider } from "../types.js";

export const xAI: ModelProvider = {
  models: [
    {
      model: "grok-beta",
      displayName: "Grok Beta",
      contextLength: 128000,
      recommendedFor: ["chat"],
      regex: /grok-beta/,
    },
    {
      model: "grok-2",
      displayName: "Grok 2",
      contextLength: 131072,
      recommendedFor: ["chat"],
      regex: /grok-2/,
    },
    {
      model: "grok-3-mini",
      displayName: "Grok 3 Mini",
      contextLength: 131072,
      maxCompletionTokens: 8000,
      recommendedFor: ["chat"],
      regex: /grok-3-mini/,
    },
    {
      model: "grok-3",
      displayName: "Grok 3",
      contextLength: 131072,
      recommendedFor: ["chat"],
      regex: /grok-3/,
    },
    {
      model: "grok-4-fast-reasoning",
      displayName: "Grok 4 Fast Reasoning",
      contextLength: 2000000,
      maxCompletionTokens: 30000,
      recommendedFor: ["chat"],
      regex: /grok-4-fast-reasoning/,
    },
    {
      model: "grok-4-fast-non-reasoning",
      displayName: "Grok 4 Fast Non-Reasoning",
      contextLength: 2000000,
      maxCompletionTokens: 30000,
      recommendedFor: ["chat"],
      regex: /grok-4-fast-non-reasoning/,
    },
    {
      model: "grok-4",
      displayName: "Grok 4 Fast",
      contextLength: 256000,
      recommendedFor: ["chat"],
      regex: /grok-4/,
    },
    {
      model: "grok-code-fast-1",
      displayName: "Grok Code Fast 1",
      contextLength: 256000,
      maxCompletionTokens: 10000,
      recommendedFor: ["chat"],
      regex: /grok-code-fast-1/,
    },
  ],
  id: "xAI",
  displayName: "xAI",
};
