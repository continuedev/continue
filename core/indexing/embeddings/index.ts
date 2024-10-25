import { EmbeddingsProviderName } from "../../index.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";
import SageMakerEmbeddingsProvider from "./SageMakerEmbeddingsProvider.js";
import BedrockEmbeddingsProvider from "./BedrockEmbeddingsProvider.js";
import CohereEmbeddingsProvider from "./CohereEmbeddingsProvider.js";
import ContinueProxyEmbeddingsProvider from "./ContinueProxyEmbeddingsProvider.js";
import DeepInfraEmbeddingsProvider from "./DeepInfraEmbeddingsProvider.js";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider.js";
import GeminiEmbeddingsProvider from "./GeminiEmbeddingsProvider.js";
import HuggingFaceTEIEmbeddingsProvider from "./HuggingFaceTEIEmbeddingsProvider.js";
import MistralEmbeddingsProvider from "./MistralEmbeddingsProvider.js";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider.js";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider.js";
import NvidiaEmbeddingsProvider from "./NvidiaEmbeddingsProvider.js";
import VoyageEmbeddingsProvider from "./VoyageEmbeddingsProvider.js";
import VertexEmbeddingsProvider from "./VertexEmbeddingsProvider.js";

type EmbeddingsProviderConstructor = new (
  ...args: any[]
) => BaseEmbeddingsProvider;

export const allEmbeddingsProviders: Record<
  EmbeddingsProviderName,
  EmbeddingsProviderConstructor
> = {
  sagemaker: SageMakerEmbeddingsProvider,
  bedrock: BedrockEmbeddingsProvider,
  ollama: OllamaEmbeddingsProvider,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  cohere: CohereEmbeddingsProvider,
  "free-trial": FreeTrialEmbeddingsProvider,
  "huggingface-tei": HuggingFaceTEIEmbeddingsProvider,
  gemini: GeminiEmbeddingsProvider,
  "continue-proxy": ContinueProxyEmbeddingsProvider,
  deepinfra: DeepInfraEmbeddingsProvider,
  nvidia: NvidiaEmbeddingsProvider,
  voyage: VoyageEmbeddingsProvider,
  mistral: MistralEmbeddingsProvider,
  vertex: VertexEmbeddingsProvider
};
