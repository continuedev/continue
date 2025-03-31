import { ModelProvider } from "../types.js";

export const Anthropic: ModelProvider = {
  id: "anthropic",
  displayName: "Anthropic",
  models: [
    {
      model: "claude-3-5-sonnet-latest",
      displayName: "Claude 3.5 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Most intelligent model with the highest level of intelligence and capability.",
      regex: /claude-3[.-]5-sonnet.*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-3-7-sonnet-latest",
      displayName: "Claude 3.7 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Most intelligent model with the highest level of intelligence and capability.",
      regex: /claude-3[.-]7-sonnet.*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-3-opus-20240229",
      displayName: "Claude 3 Opus",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Powerful model for highly complex tasks with top-level performance, intelligence, fluency, and understanding.",
      regex: /claude-3-opus/i,
    },
    {
      model: "claude-3-sonnet-20240229",
      displayName: "Claude 3 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Balance of intelligence and speed with strong utility, balanced for scaled deployments.",
      regex: /claude-3-sonnet/i,
    },
    {
      model: "claude-3-haiku-20240307",
      displayName: "Claude 3 Haiku",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Fastest and most compact model for near-instant responsiveness with quick and accurate targeted performance.",
      regex: /claude-3-haiku/i,
    },
    {
      model: "claude-2.1",
      displayName: "Claude 2.1",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Updated version of Claude 2 with improved accuracy and consistency.",
      regex: /claude-2\.1/i,
    },
    {
      model: "claude-2.0",
      displayName: "Claude 2",
      contextLength: 100000,
      maxCompletionTokens: 4096,
      description:
        "Predecessor to Claude 3, offering strong all-round performance.",
      regex: /claude-2\.0/i,
    },
    {
      model: "claude-instant-1.2",
      displayName: "Claude Instant 1.2",
      contextLength: 100000,
      maxCompletionTokens: 4096,
      description:
        "Our cheapest small and fast model, a predecessor of Claude Haiku.",
      regex: /claude-instant-1\.2/i,
    },
  ],
};
