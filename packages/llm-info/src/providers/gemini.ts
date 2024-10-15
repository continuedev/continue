import { AllMediaTypes } from "../types.js";
import { llms } from "../util.js";

export const GeminiLlms = llms("gemini", [
  {
    model: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    contextLength: 1_048_576,
    maxCompletionTokens: 8192,
    mediaTypes: AllMediaTypes,
    regex: /gemini-1\.5-flash/i,
    recommendedFor: ["chat"],
  },
  {
    model: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    contextLength: 2_097_152,
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
]);
