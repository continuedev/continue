import { llms } from "../util.js";

export const AzureLlms = llms("azure", [
  {
    model: "gpt-4o",
    displayName: "GPT-4o",
    contextLength: 128_000,
    recommendedFor: ["chat"],
  },
  {
    model: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    contextLength: 128_000,
    recommendedFor: ["chat"],
  },
]);
