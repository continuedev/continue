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
    // embed
    {
      model: "text-embedding-005",
      displayName: "Vertex Text Embedding",
      recommendedFor: ["embed"],
    },
    //autocomplete
    {
      model: "code-gecko",
      displayName: "VertexAI Code Gecko",
      recommendedFor: ["autocomplete"],
      maxCompletionTokens: 64,
    },
  ],
  id: "gemini",
  displayName: "Gemini",
};
