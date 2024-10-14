import { AnthropicLlms } from "./models/anthropic.js";
import { AzureLlms } from "./models/azure.js";
import { BedrockLlms } from "./models/bedrock.js";
import { CohereLlms } from "./models/cohere.js";
import { GeminiLlms } from "./models/gemini.js";
import { MistralLlms } from "./models/mistral.js";
import { OllamaLlms } from "./models/ollama.js";
import { OpenAiLlms } from "./models/openai.js";
import { vllmLlms } from "./models/vllm.js";
import { VoyageLlms } from "./models/voyage.js";
import { LlmInfo, UseCase } from "./types.js";

export const allLlms: LlmInfo[] = [
  ...OpenAiLlms,
  ...GeminiLlms,
  ...AnthropicLlms,
  ...MistralLlms,
  ...VoyageLlms,
  ...AzureLlms,
  ...OllamaLlms,
  ...vllmLlms,
  ...BedrockLlms,
  ...CohereLlms,
];

export function findLlmInfo(model: string): LlmInfo | undefined {
  return allLlms.find((llm) =>
    llm.regex ? llm.regex.test(model) : llm.model === model,
  );
}

export function getAllRecommendedFor(useCase: UseCase): LlmInfo[] {
  return allLlms.filter((llm) => llm.recommendedFor?.includes(useCase));
}
