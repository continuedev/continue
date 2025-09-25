import { Anthropic } from "./providers/anthropic.js";
import { Azure } from "./providers/azure.js";
import { Bedrock } from "./providers/bedrock.js";
import { Cohere } from "./providers/cohere.js";
import { CometAPI } from "./providers/cometapi.js";
import { Gemini } from "./providers/gemini.js";
import { Mistral } from "./providers/mistral.js";
import { Ollama } from "./providers/ollama.js";
import { OpenAi } from "./providers/openai.js";
import { Vllm } from "./providers/vllm.js";
import { Voyage } from "./providers/voyage.js";
import { xAI } from "./providers/xAI.js";
import { LlmInfoWithProvider, ModelProvider, UseCase } from "./types.js";

export const allModelProviders: ModelProvider[] = [
  OpenAi,
  Gemini,
  Anthropic,
  Mistral,
  Voyage,
  Azure,
  Ollama,
  Vllm,
  Bedrock,
  Cohere,
  CometAPI,
  xAI,
];

export const allLlms: LlmInfoWithProvider[] = allModelProviders.flatMap(
  (provider) =>
    provider.models.map((model) => ({ ...model, provider: provider.id })),
);

export function findLlmInfo(
  model: string,
  preferProviderId?: string,
): LlmInfoWithProvider | undefined {
  if (preferProviderId) {
    const provider = allModelProviders.find((p) => p.id === preferProviderId);
    const info = provider?.models.find((llm) =>
      llm.regex ? llm.regex.test(model) : llm.model === model,
    );
    if (info) {
      return {
        ...info,
        provider: preferProviderId,
      };
    }
  }
  return allLlms.find((llm) =>
    llm.regex ? llm.regex.test(model) : llm.model === model,
  );
}

export function getAllRecommendedFor(useCase: UseCase): LlmInfoWithProvider[] {
  return allLlms.filter((llm) => llm.recommendedFor?.includes(useCase));
}
