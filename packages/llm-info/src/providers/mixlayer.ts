import { MediaType, ModelProvider } from "../types.js";

export const Mixlayer: ModelProvider = {
  models: [
    {
      model: "z-ai/glm-5.3",
      displayName: "GLM 5.3",
      contextLength: 262144,
      description:
        "Text model with tool calling. Reasoning is always on (Low/High/Max; none is rejected).",
      regex: /^z-ai\/glm-5\.3$/,
      recommendedFor: ["chat"],
    },
    {
      model: "qwen/qwen3.8-27b",
      displayName: "Qwen3.8 27B",
      contextLength: 262144,
      description:
        "Text and image model with tool calling. Optional thinking (default on; none disables).",
      regex: /^qwen\/qwen3\.8-27b$/,
      mediaTypes: [MediaType.Text, MediaType.Image],
      recommendedFor: ["chat"],
    },
    {
      model: "qwen/qwen3.6-35b-a3b",
      displayName: "Qwen3.6 35B A3B",
      contextLength: 131072,
      description:
        "Text and image model with tool calling. Optional thinking (default on; none disables).",
      regex: /^qwen\/qwen3\.6-35b-a3b$/,
      mediaTypes: [MediaType.Text, MediaType.Image],
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek/deepseek-v4.1-flash",
      displayName: "DeepSeek V4.1 Flash",
      contextLength: 262144,
      description:
        "Text model with tool calling. Optional thinking (default High; none disables).",
      regex: /^deepseek\/deepseek-v4\.1-flash$/,
      recommendedFor: ["chat"],
    },
    {
      model: "qwen/qwen3.5-9b",
      displayName: "Qwen3.5 9B",
      contextLength: 131072,
      description:
        "Text and image model with tool calling. Optional thinking (default on; none disables).",
      regex: /^qwen\/qwen3\.5-9b$/,
      mediaTypes: [MediaType.Text, MediaType.Image],
      recommendedFor: ["chat"],
    },
    {
      model: "qwen/qwen3.5-4b-free",
      displayName: "Qwen3.5 4B (Free)",
      contextLength: 131072,
      description:
        "Free text and image model with tool calling. Optional thinking (default on; none disables).",
      regex: /^qwen\/qwen3\.5-4b-free$/,
      mediaTypes: [MediaType.Text, MediaType.Image],
      recommendedFor: ["chat"],
    },
  ],
  id: "mixlayer",
  displayName: "Mixlayer",
};
