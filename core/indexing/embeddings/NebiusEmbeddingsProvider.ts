import { EmbeddingsProviderName, EmbedOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class NebiusEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "nebius";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.studio.nebius.ai/v1/",
    model: "BAAI/bge-en-icl",
  };
}

export default NebiusEmbeddingsProvider;
