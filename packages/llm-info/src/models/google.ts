import { AllMediaTypes, LlmInfo } from "../types.js";

export const GoogleLlms: LlmInfo[] = [
  {
    model: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    contextLength: 1_048_576,
    maxCompletionTokens: 8192,
    mediaTypes: AllMediaTypes,
    regex: /gemini-1\.5-flash/i,
  },
  {
    model: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    contextLength: 2_097_152,
    maxCompletionTokens: 8192,
    regex: /gemini-1\.5-pro/i,
  },
  {
    model: "gemini-1.0-pro",
    displayName: "Gemini 1.0 Pro",
    regex: /gemini-1\.0-pro/i,
  },
];
