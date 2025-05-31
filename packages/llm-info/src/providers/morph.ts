import { ModelProvider } from "../types.js";

export const Morph: ModelProvider = {
  models: [
    {
      model: "morph-rerank-v2",
      displayName: "Morph Rerank v2",
      // contextLength: 128000,
      // maxCompletionTokens: 4000,
      // recommendedFor: ["rerank"],
    },
    {
      model: "morph-v2",
      displayName: "Morph Fast Apply v2",
      // contextLength: 128000,
      // maxCompletionTokens: 4000,
    },
    {
      model: "morph-embedding-v2",
      displayName: "Morph Embedding v2",
      // recommendedFor: ["embed"],
      // contextLength: 512,
    },
  ],
  id: "morph",
  displayName: "Morph",
};
