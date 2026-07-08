import { ModelProvider } from "../types.js";

export const Voyage: ModelProvider = {
  models: [
    {
      model: "voyage-code-2",
      displayName: "Voyage Code 2",
      contextLength: 8096,
    },
    {
      model: "voyage-code-3",
      displayName: "Voyage Code 3",
      contextLength: 8096,
      recommendedFor: ["embed"],
    },
    {
      model: "rerank-2",
      displayName: "Rerank 2",
      contextLength: 8096,
      recommendedFor: ["rerank"],
    },
    {
      model: "rerank-2-lite",
      displayName: "Rerank 2 Lite",
      contextLength: 8096,
    },
    {
      model: "rerank-lite-1",
      displayName: "Rerank Lite 1",
      contextLength: 8096,
    },
  ],
  id: "voyage",
  displayName: "Voyage",
};
