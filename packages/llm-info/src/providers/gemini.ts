import { AllMediaTypes, ModelProvider } from "../types.js";

export const Gemini: ModelProvider = {
  models: [
    {
      model: "gemini-2.0-flash",
      displayName: "Gemini 2.0 Flash",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.0-flash/i,
      recommendedFor: ["chat"]
    },
    {
      model: "gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-1\.5-flash/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro",
      contextLength: 2097152,
      maxCompletionTokens: 8192,
      regex: /gemini-1\.5-pro/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.0-pro",
      displayName: "Gemini 1.0 Pro",
      regex: /gemini-1\.0-pro/i,
    },
    // embed
    {
      model: "models/text-embedding-004",
      displayName: "Gemini Text Embedding",
      recommendedFor: ["embed"],
    },
  ],
  id: "gemini",
  displayName: "Gemini",
};
