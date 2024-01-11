import { EmbeddingsProviderName } from "../..";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";

export const AllEmbeddingsProviders: {
  [key in EmbeddingsProviderName]: any;
} = {
  ollama: OllamaEmbeddingsProvider,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
};
