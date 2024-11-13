import { EmbeddingsProviderName, EmbedOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class VoyageEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "voyage";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.voyageai.com/v1/",
    model: "voyage-code-2",
  };
}

export default VoyageEmbeddingsProvider;
