import { ModelProvider } from "../types.js";

export const Inception: ModelProvider = {
  models: [
    {
      model: "mercury-2",
      displayName: "Mercury 2",
      contextLength: 128000,
      description:
        "Inception Labs' fastest reasoning diffusion model and their most powerful model, with tool calling and structured outputs support.",
      regex: /mercury-2/i,
      recommendedFor: ["chat"],
    },
    {
      model: "mercury-edit-2",
      displayName: "Mercury Edit 2",
      contextLength: 32000,
      description:
        "Inception Labs' code editing model for autocomplete, apply edit, and next edit suggestions.",
      regex: /mercury-edit-2/i,
      recommendedFor: ["autocomplete"],
    },
    {
      model: "mercury-coder-small",
      displayName: "Mercury Coder Small",
      contextLength: 32000,
      regex: /mercury-coder-small/i,
    },
  ],
  id: "inception",
  displayName: "Inception Labs",
};
