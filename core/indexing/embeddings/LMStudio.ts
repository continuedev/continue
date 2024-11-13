import { EmbeddingsProviderName, EmbedOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class LMStudioEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "lmstudio";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "http://localhost:1234/v1",
    model: "nomic-ai/nomic-embed-text-v1.5-GGUF",
  };
}

export default LMStudioEmbeddingsProvider;