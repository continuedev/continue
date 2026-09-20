import { ModelProvider } from "../types.js";

export const AtlasCloud: ModelProvider = {
  models: [
    {
      model: "openai/gpt-4.1-mini",
      displayName: "GPT-4.1 Mini (Atlas Cloud)",
      contextLength: 1_047_576,
      maxCompletionTokens: 32_768,
      description:
        "OpenAI GPT-4.1 Mini, served through the Atlas Cloud gateway.",
      regex: /^openai\/gpt-4\.1-mini$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "openai/gpt-5.4-mini",
      displayName: "GPT-5.4 Mini (Atlas Cloud)",
      contextLength: 400_000,
      maxCompletionTokens: 131_072,
      description:
        "OpenAI GPT-5.4 Mini, served through the Atlas Cloud gateway.",
      regex: /^openai\/gpt-5\.4-mini$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "anthropic/claude-sonnet-4.6",
      displayName: "Claude Sonnet 4.6 (Atlas Cloud)",
      contextLength: 200_000,
      maxCompletionTokens: 64_000,
      description:
        "Anthropic Claude Sonnet 4.6, served through the Atlas Cloud gateway.",
      regex: /^anthropic\/claude-sonnet-4\.6$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-ai/deepseek-v3.2",
      displayName: "DeepSeek V3.2 (Atlas Cloud)",
      contextLength: 163_840,
      maxCompletionTokens: 163_840,
      description: "DeepSeek V3.2, served through the Atlas Cloud gateway.",
      regex: /^deepseek-ai\/deepseek-v3\.2$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "Qwen/Qwen3-235B-A22B-Instruct-2507",
      displayName: "Qwen3 235B Instruct (Atlas Cloud)",
      contextLength: 131_072,
      maxCompletionTokens: 131_072,
      description:
        "Qwen3-235B-A22B-Instruct, served through the Atlas Cloud gateway.",
      regex: /^Qwen\/Qwen3-235B-A22B-Instruct-2507$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "qwen/qwen3.5-35b-a3b",
      displayName: "Qwen3.5 35B A3B (Atlas Cloud)",
      contextLength: 262_144,
      maxCompletionTokens: 65_536,
      description: "Qwen3.5 35B A3B, served through the Atlas Cloud gateway.",
      regex: /^qwen\/qwen3\.5-35b-a3b$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "zai-org/GLM-4.6",
      displayName: "GLM-4.6 (Atlas Cloud)",
      contextLength: 202_752,
      maxCompletionTokens: 202_752,
      description: "Z.AI GLM-4.6, served through the Atlas Cloud gateway.",
      regex: /^zai-org\/GLM-4\.6$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "moonshotai/kimi-k2.5",
      displayName: "Kimi K2.5 (Atlas Cloud)",
      contextLength: 262_144,
      maxCompletionTokens: 262_144,
      description:
        "Moonshot Kimi K2.5, served through the Atlas Cloud gateway.",
      regex: /^moonshotai\/kimi-k2\.5$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "minimaxai/minimax-m2.5",
      displayName: "MiniMax M2.5 (Atlas Cloud)",
      contextLength: 196_608,
      maxCompletionTokens: 196_608,
      description: "MiniMax M2.5, served through the Atlas Cloud gateway.",
      regex: /^minimaxai\/minimax-m2\.5$/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "atlascloud",
  displayName: "Atlas Cloud",
};
