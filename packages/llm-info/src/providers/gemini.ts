import { AllMediaTypes, ModelProvider } from "../types.js";

// See https://ai.google.dev/gemini-api/docs/models
export const Gemini: ModelProvider = {
  models: [
    {
      model: "gemini-3-pro-preview",
      displayName: "Gemini 3 Pro Preview",
      description:
        "Google's flagship frontier model with high precision multimodal capabilities.",
      contextLength: 1048576,
      maxCompletionTokens: 65536,
      mediaTypes: AllMediaTypes,
      regex: /gemini-3-pro-preview/i,
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
    {
      model: "gemini-2.0-flash-preview-image-generation",
      displayName: "Gemini 2.0 Flash Image Generation Preview",
      description:
        "Model with image generation capabilities and improved visual quality",
      contextLength: 32000,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.0-flash-preview-image-generation/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash-exp-image-generation",
      displayName: "Gemini 2.0 Flash Image Generation Experimental",
      description: "Experimental model with image generation capabilities",
      contextLength: 32000,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-2\.0-flash-exp-image-generation/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash-exp",
      displayName: "Gemini 2.0 Flash Experimental",
      description:
        "Experimental version of Gemini 2.0 Flash with extended capabilities",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /^gemini-2\.0-flash-exp$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      description: "Fast multimodal model with 1M token context window",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-1\.5-flash/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.5-flash-8b",
      displayName: "Gemini 1.5 Flash 8b",
      description:
        "Smaller version of Gemini 1.5 Flash optimized for efficiency",
      contextLength: 1048576,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-1\.5-flash-8b/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro",
      description:
        "Mid-size multimodal model capable of handling extensive inputs and complex reasoning tasks",
      contextLength: 2097152,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-1\.5-pro/i,
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-1.0-pro",
      displayName: "Gemini 1.0 Pro",
      description: "First generation Gemini pro model",
      contextLength: 32768,
      maxCompletionTokens: 8192,
      mediaTypes: AllMediaTypes,
      regex: /gemini-1\.0-pro/i,
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
