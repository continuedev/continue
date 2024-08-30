import { EmbeddingsProviderName } from "../../index.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";
import CohereEmbeddingsProvider from "./CohereEmbeddingsProvider.js";
import ContinueProxyEmbeddingsProvider from "./ContinueProxyEmbeddingsProvider.js";
import DeepInfraEmbeddingsProvider from "./DeepInfraEmbeddingsProvider.js";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider.js";
import GeminiEmbeddingsProvider from "./GeminiEmbeddingsProvider.js";
import HuggingFaceTEIEmbeddingsProvider from "./HuggingFaceTEIEmbeddingsProvider.js";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider.js";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider.js";
import VoyageEmbeddingsProvider from "./VoyageEmbeddingsProvider.js";

type EmbeddingsProviderConstructor = new (
  ...args: any[]
) => BaseEmbeddingsProvider;

export const allEmbeddingsProviders: Record<
  EmbeddingsProviderName,
  EmbeddingsProviderConstructor
> = {
  ollama: OllamaEmbeddingsProvider,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  cohere: CohereEmbeddingsProvider,
  "free-trial": FreeTrialEmbeddingsProvider,
  "huggingface-tei": HuggingFaceTEIEmbeddingsProvider,
  gemini: GeminiEmbeddingsProvider,
  "continue-proxy": ContinueProxyEmbeddingsProvider,
  deepinfra: DeepInfraEmbeddingsProvider,
  voyage: VoyageEmbeddingsProvider,
};
