import { llms } from "../util.js";

export const VoyageLlms = llms("voyage", [
  {
    model: "voyage-code-2",
    displayName: "Voyage Code 2",
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
]);
