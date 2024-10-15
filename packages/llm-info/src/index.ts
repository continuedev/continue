import { AnthropicLlms } from "./providers/anthropic.js";
import { AzureLlms } from "./providers/azure.js";
import { BedrockLlms } from "./providers/bedrock.js";
import { CohereLlms } from "./providers/cohere.js";
import { GeminiLlms } from "./providers/gemini.js";
import { MistralLlms } from "./providers/mistral.js";
import { OllamaLlms } from "./providers/ollama.js";
import { OpenAiLlms } from "./providers/openai.js";
import { vllmLlms } from "./providers/vllm.js";
import { VoyageLlms } from "./providers/voyage.js";
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
