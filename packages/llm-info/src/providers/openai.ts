import { ModelProvider } from "../types.js";

export const OpenAi: ModelProvider = {
  models: [
    {
      model: "gpt-3.5-turbo",
      displayName: "GPT-3.5 Turbo",
      contextLength: 16385,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-3.5-turbo-0613",
      displayName: "GPT-3.5 Turbo",
      contextLength: 16385,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-3.5-turbo-16k",
      displayName: "GPT-3.5 Turbo 16K",
      contextLength: 16384,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-35-turbo-16k",
      displayName: "GPT-3.5 Turbo 16K",
      contextLength: 16384,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-35-turbo-0613",
      displayName: "GPT-3.5 Turbo (0613)",
      contextLength: 4096,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-35-turbo",
      displayName: "GPT-3.5 Turbo",
      contextLength: 4096,
      maxCompletionTokens: 4096,
    },
    // gpt-4
    {
      model: "gpt-4",
      displayName: "GPT-4",
      contextLength: 8192,
      maxCompletionTokens: 8192,
    },
    {
      model: "gpt-4-32k",
      displayName: "GPT-4 32K",
      contextLength: 32000,
      maxCompletionTokens: 8192,
    },
    {
      model: "gpt-4-turbo-preview",
      displayName: "GPT-4 Turbo Preview",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-4-vision",
      displayName: "GPT-4 Vision",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-4-0125-preview",
      displayName: "GPT-4 (0125 Preview)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    {
      model: "gpt-4-1106-preview",
      displayName: "GPT-4 (1106 Preview)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
    },
    // gpt-4o
    {
      model: "gpt-4o",
      displayName: "GPT-4o",
      contextLength: 128000,
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-4o-mini",
      displayName: "GPT-4o Mini",
      contextLength: 128000,
      recommendedFor: ["chat"],
    },
    // o1
    {
      model: "o1-preview",
      displayName: "o1 Preview",
      contextLength: 128000,
      maxCompletionTokens: 32768,
      recommendedFor: ["chat"],
    },
    {
      model: "o1-mini",
      displayName: "o1 Mini",
      contextLength: 128000,
      maxCompletionTokens: 65536,
      recommendedFor: ["chat"],
    },
    {
      model: "o3-mini",
      displayName: "o3 Mini",
      contextLength: 128000,
      maxCompletionTokens: 65536,
      recommendedFor: ["chat"],
    },
    // embed
    {
      model: "text-embedding-3-large",
      displayName: "Text Embedding 3-Large",
      recommendedFor: ["embed"],
    },
    {
      model: "text-embedding-3-small",
      displayName: "Text Embedding 3-Small",
    },
    {
      model: "text-embedding-ada-002",
      displayName: "Text Embedding Ada-002",
    },
  ],
  id: "openai",
  displayName: "OpenAI",
};
