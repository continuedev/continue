import { LLMOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class VoyageEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName = "voyage";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.voyageai.com/v1/",
    model: "voyage-code-2",
  };
}

export default VoyageEmbeddingsProvider;
