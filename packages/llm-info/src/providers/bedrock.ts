import { llms } from "../util.js";

export const BedrockLlms = llms("bedrock", [
  {
    model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    displayName: "Claude 3.5 Sonnet",
    contextLength: 200_000,
    maxCompletionTokens: 8192,
  },
  {
    model: "meta.llama3-1-405b-instruct-v1:0",
    displayName: "Llama 3.1 405B",
  },
  {
    model: "meta.llama3-2-90b-instruct-v1:0",
    displayName: "Llama 3.2 90B",
  },
  {
    model: "mistral.mistral-large-2407-v1:0",
    displayName: "Mistral Large 2",
  },
]);
