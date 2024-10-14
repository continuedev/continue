import { llms } from "../util.js";

export const CohereLlms = llms("cohere", [
  {
    model: "command-r-plus",
    displayName: "Command R+",
    contextLength: 128_000,
    maxCompletionTokens: 4_000,
    // recommendedFor: ["chat"],
  },
  {
    model: "command-r",
    displayName: "Command R",
    contextLength: 128_000,
    maxCompletionTokens: 4_000,
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
    contextLength: 4_000,
  },
]);
