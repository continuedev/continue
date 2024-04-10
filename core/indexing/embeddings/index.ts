import { EmbeddingsProviderName } from "../..";
import FreeTrialEmbeddingsProvider from "./FreeTrialEmbeddingsProvider";
import OllamaEmbeddingsProvider from "./OllamaEmbeddingsProvider";
import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";

type EmbeddingsProviderConstructor = new (
  ...args: any[]
) => BaseEmbeddingsProvider;

export const allEmbeddingsProviders: Record<
  EmbeddingsProviderName,
  EmbeddingsProviderConstructor
> = {
  ollama: OllamaEmbeddingsProvider,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAIEmbeddingsProvider,
  "free-trial": FreeTrialEmbeddingsProvider,
};
