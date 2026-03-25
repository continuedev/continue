import { AllMediaTypes, ModelProvider } from "../types.js";

// See https://ai.google.dev/gemini-api/docs/models
export const Gemini: ModelProvider = {
  models: [
    // Gemini 3.1 series
    {
      model: "gemini-3.1-pro-preview",
      displayName: "Gemini 3.1 Pro Preview",
      description:
        "Google's most capable model with 2M context window and high precision multimodal capabilities.",
      contextLength: 2097152,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3\.1-pro-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-3.1-flash-lite-preview",
      displayName: "Gemini 3.1 Flash Lite Preview",
      description:
        "Cost-efficient model optimized for high-volume tasks with fast inference.",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3\.1-flash-lite-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-3.1-flash-image-preview",
      displayName: "Gemini 3.1 Flash Image Preview",
      description: "Image generation model with improved visual quality.",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3\.1-flash-image-preview/i,
      recommendedFor: ["chat"],
    },
    // Gemini 3 series
    {
      model: "gemini-3-flash-preview",
      displayName: "Gemini 3 Flash Preview",
      description:
        "High-speed thinking model for agentic workflows, multi-turn chat, and coding.",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3-flash-preview/i,
      recommendedFor: ["chat"],
    },
    // Gemini 2.5 series (deprecating June 17, 2026)
    {
      model: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      description:
        "Google's advanced model with strong reasoning, multimodal capabilities, and advanced coding skills",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.5-pro$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-pro-preview-05-06",
      displayName: "Gemini 2.5 Pro Preview",
      description:
        "Google's advanced model with strong reasoning, multimodal capabilities, and advanced coding skills",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.5-pro-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      description:
        "Fast, token-efficient multimodal model for complex tasks with 1M context window",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.5-flash$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash-preview-05-20",
      displayName: "Gemini 2.5 Flash Preview",
      description:
        "Fast, token-efficient multimodal model for complex tasks with 1M context window",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.5-flash-preview/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash-lite",
      displayName: "Gemini 2.5 Flash Lite",
      description:
        "Lightweight, fast model optimized for low-latency tasks with 1M context window",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.5-flash-lite/i,
      recommendedFor: ["chat"],
    },
    // Gemini 2.0 series (deprecating June 1, 2026)
    {
      model: "gemini-2.0-flash", // stable gemini-2.0-flash-001
      displayName: "Gemini 2.0 Flash",
      description: "Fast, efficient model with strong multimodal capabilities",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.0-flash$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash-lite", // stable gemini-2.0-flash-lite-001
      displayName: "Gemini 2.0 Flash Lite",
      description:
        "Small, fast model with reduced latency and memory requirements",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.0-flash-lite$/i,
      recommendedFor: ["chat"],
    },
    // embed
    {
      model: "models/text-embedding-004",
      displayName: "Gemini Text Embedding",
      description: "Text embedding model for vectorizing content",
      recommendedFor: ["embed"],
    },
  ],
  id: "gemini",
  displayName: "Gemini",
};
