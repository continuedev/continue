import { EmbeddingsProviderName } from "../..";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";

export const AllEmbeddingsProviders: {
  [key in EmbeddingsProviderName]: any;
} = {
  ollama: OllamaEmbeddingsProvider,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  "free-trial": FreeTrialEmbeddingsProvider,
};
