import { ModelProvider } from "../types.js";

export const OpenRouter: ModelProvider = {
  models: [
    {
      model: "openai/gpt-4o",
      displayName: "GPT-4o",
      contextLength: 128000,
      maxCompletionTokens: 16384,
    },
    {
      model: "openai/gpt-4o-mini",
      displayName: "GPT-4o Mini",
      contextLength: 128000,
      maxCompletionTokens: 16384,
    },
    {
      model: "anthropic/claude-3.5-sonnet",
      displayName: "Claude 3.5 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 8192,
    },
    {
      model: "anthropic/claude-3-haiku",
      displayName: "Claude 3 Haiku",
      contextLength: 200000,
      maxCompletionTokens: 4096,
    },
    {
      model: "meta-llama/llama-3.1-405b-instruct",
      displayName: "Llama 3.1 405B Instruct",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
    {
      model: "meta-llama/llama-3.1-70b-instruct",
      displayName: "Llama 3.1 70B Instruct",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
    {
      model: "meta-llama/llama-3.1-8b-instruct",
      displayName: "Llama 3.1 8B Instruct",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
    {
      model: "google/gemini-pro-1.5",
      displayName: "Gemini Pro 1.5",
      contextLength: 2097152,
      maxCompletionTokens: 8192,
    },
    {
      model: "mistralai/mistral-large",
      displayName: "Mistral Large",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "cohere/command-r-plus",
      displayName: "Command R+",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "deepseek/deepseek-chat",
      displayName: "DeepSeek Chat",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "qwen/qwen-2.5-72b-instruct",
      displayName: "Qwen 2.5 72B Instruct",
      contextLength: 131072,
      maxCompletionTokens: 8192,
    },
    {
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
      displayName: "Llama 3.1 Nemotron 70B",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
    {
      model: "x-ai/grok-beta",
      displayName: "Grok Beta",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
    {
      model: "perplexity/llama-3.1-sonar-large-128k-online",
      displayName: "Llama 3.1 Sonar Large (Online)",
      contextLength: 131072,
      maxCompletionTokens: 4096,
    },
  ],
  id: "openrouter",
  displayName: "OpenRouter",
};
