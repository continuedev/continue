import { ModelProvider } from "../types.js";

export const Anthropic: ModelProvider = {
  id: "anthropic",
  displayName: "Anthropic",
  models: [
    {
      model: "claude-sonnet-4-5-20250929",
      displayName: "Claude 4.5 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      description:
        "Anthropic's smartest model for complex agents and coding with exceptional performance in reasoning and multilingual tasks.",
      regex: /claude-(?:4[.-]5-sonnet|sonnet-4[.-]5).*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-haiku-4-5-20251001",
      displayName: "Claude 4.5 Haiku",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      description:
        "Anthropic's fastest model with near-frontier intelligence, ideal for quick and accurate responses.",
      regex: /claude-(?:4[.-]5-haiku|haiku-4[.-]5).*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-opus-4-1-20250805",
      displayName: "Claude 4.1 Opus",
      contextLength: 200000,
      maxCompletionTokens: 32000,
      description:
        "Exceptional model for specialized reasoning tasks with advanced agentic capabilities and superior coding performance.",
      regex: /claude-opus-4[.-]1.*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-sonnet-4-20250514",
      displayName: "Claude 4 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Previous generation model with strong coding and reasoning capabilities, now superseded by Claude 4.5 Sonnet.",
      // Sometimes written as claude-4-sonnet, other times as claude-sonnet-4
      regex: /claude-(?:4-sonnet|sonnet-4).*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-opus-4-5",
      displayName: "Claude Opus 4.5",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      description:
        "Most intelligent model with the highest level of intelligence and capability.",
      regex: /claude-(?:4-5-opus|opus-4-5).*/i,
      recommendedFor: ["chat"],
    },
    // order matters for regex conflicts
    {
      model: "claude-opus-4.1",
      displayName: "Claude Opus 4.1",
      contextLength: 200000,
      maxCompletionTokens: 32000,
      description: "Previous iteration on Opus",
      regex: /claude-(?:4[.-]1-opus|opus-4[.-]1).*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-opus-4",
      displayName: "Claude 4 Opus",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Previous generation model with high intelligence, now superseded by Claude 4.1 Opus.",
      regex: /claude-(?:4-opus|opus-4).*/i,
      recommendedFor: ["chat"],
    },

    {
      model: "claude-3-7-sonnet-latest",
      displayName: "Claude 3.7 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 128000,
      description:
        "First hybrid reasoning model with extended thinking capabilities, excellent for coding and front-end development.",
      regex: /claude-3[.-]7-sonnet.*/i,
      recommendedFor: ["chat"],
    },
    {
      model: "claude-3-5-sonnet-latest",
      displayName: "Claude 3.5 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Previous flagship model with strong performance across diverse tasks, now superseded by Claude 4.5.",
      regex: /claude-3[.-]5-sonnet.*/i,
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
        "Anthropic's cheapest small and fast model, a predecessor of Claude Haiku.",
      regex: /claude-instant-1\.2/i,
    },
  ],
};
