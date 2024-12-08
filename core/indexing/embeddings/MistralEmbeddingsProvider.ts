import { LLMOptions } from "../../index.js";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider.js";

class MistralEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName = "mistral";
  static maxBatchSize = 128;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.mistral.ai/v1/",
    model: "mistral-embed",
  };
}

export default MistralEmbeddingsProvider;
