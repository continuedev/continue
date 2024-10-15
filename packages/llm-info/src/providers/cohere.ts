import { ModelProvider } from "../types.js";

export const Cohere: ModelProvider = {
  models: [
    {
      model: "command-r-plus",
      displayName: "Command R+",
      contextLength: 128000,
      maxCompletionTokens: 4000,
      // recommendedFor: ["chat"],
    },
    {
      model: "command-r",
      displayName: "Command R",
      contextLength: 128000,
      maxCompletionTokens: 4000,
    },
    {
      model: "embed-english-v3.0",
      displayName: "Embed English 3.0",
      // recommendedFor: ["embed"],
      contextLength: 512,
    },
    {
      model: "rerank-english-v3.0",
      displayName: "Rerank English 3.0",
      // recommendedFor: ["rerank"],
      contextLength: 4000,
    },
  ],
  id: "cohere",
  displayName: "Cohere",
};
