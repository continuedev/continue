import { LLMOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class NebiusEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName = "nebius";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.studio.nebius.ai/v1/",
    model: "BAAI/bge-en-icl",
  };
}

export default NebiusEmbeddingsProvider;
