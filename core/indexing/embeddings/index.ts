import { EmbeddingsProviderName } from "../../index.js";
import CohereEmbeddingsProvider from "./CohereEmbeddingsProvider.js";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider.js";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider.js";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider.js";

export const AllEmbeddingsProviders: {
  [key in EmbeddingsProviderName]: any;
} = {
  ollama: OllamaEmbeddingsProvider,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  cohere: CohereEmbeddingsProvider,
  "free-trial": FreeTrialEmbeddingsProvider,
};
