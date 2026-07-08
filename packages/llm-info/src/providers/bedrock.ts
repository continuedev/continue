import { ModelProvider } from "../types.js";

export const Bedrock: ModelProvider = {
  models: [
    {
      model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
      displayName: "Claude Sonnet 4.5",
      contextLength: 200000,
      maxCompletionTokens: 64000,
    },
    {
      model: "anthropic.claude-opus-4-6-v1",
      displayName: "Claude Opus 4.6",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      model: "anthropic.claude-haiku-4-5-20251001-v1:0",
      displayName: "Claude Haiku 4.5",
      contextLength: 200000,
      maxCompletionTokens: 64000,
    },
    {
      model: "amazon.nova-pro-v1:0",
      displayName: "Amazon Nova Pro",
      contextLength: 300000,
      maxCompletionTokens: 8192,
    },
    {
      model: "amazon.nova-lite-v1:0",
      displayName: "Amazon Nova Lite",
      contextLength: 300000,
      maxCompletionTokens: 8192,
    },
    {
      model: "amazon.nova-micro-v1:0",
      displayName: "Amazon Nova Micro",
      contextLength: 128000,
      maxCompletionTokens: 8192,
    },
    {
      model: "meta.llama4-maverick-17b-instruct-v1:0",
      displayName: "Llama 4 Maverick 17B",
      contextLength: 1000000,
      maxCompletionTokens: 16384,
    },
    {
      model: "deepseek.r1-v1:0",
      displayName: "DeepSeek R1",
      contextLength: 128000,
      maxCompletionTokens: 32768,
    },
    {
      model: "deepseek.v3-v1:0",
      displayName: "DeepSeek V3",
      contextLength: 163840,
      maxCompletionTokens: 81920,
    },
    {
      model: "deepseek.v3.2-v1:0",
      displayName: "DeepSeek V3.2",
      contextLength: 163840,
      maxCompletionTokens: 81920,
    },
  ],
  id: "bedrock",
  displayName: "Bedrock",
};
