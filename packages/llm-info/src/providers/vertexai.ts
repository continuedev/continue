import { AllMediaTypes, ModelProvider } from "../types.js";

export const Gemini: ModelProvider = {
  models: [
    {
      model: "gemini-3.1-pro-preview",
      displayName: "Gemini 3.1 Pro Preview",
      contextLength: 2097152,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3\.1-pro-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-3-flash-preview",
      displayName: "Gemini 3 Flash Preview",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3-flash-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.5-pro$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.5-flash$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash",
      displayName: "Gemini 2.0 Flash",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.0-flash$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash-lite",
      displayName: "Gemini 2.0 Flash Lite",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.0-flash-lite$/i,
      recommendedFor: ["chat"],
    },
    // embed
    {
      model: "text-embedding-005",
      displayName: "Vertex Text Embedding",
      recommendedFor: ["embed"],
    },
  ],
  id: "gemini",
  displayName: "Gemini",
};
