import { ModelProvider } from "../types.js";

export const Zima: ModelProvider = {
  models: [
    {
      model: "gpt-4o",
      displayName: "GPT-4o (Zima)",
      contextLength: 128000,
      description:
        "OpenAI's GPT-4o served through Zima's privacy-preserving infrastructure. Zima's hardware ensures prompts and outputs are never visible to the provider.",
      regex: /gpt-4o/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-4o-mini",
      displayName: "GPT-4o Mini (Zima)",
      contextLength: 128000,
      description:
        "Faster, lightweight GPT-4o Mini served through Zima's privacy-preserving infrastructure.",
      regex: /gpt-4o-mini/i,
      recommendedFor: ["chat", "autocomplete"],
    },
  ],
  id: "zima",
  displayName: "Zima",
};