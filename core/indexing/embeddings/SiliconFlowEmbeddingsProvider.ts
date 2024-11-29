import { EmbeddingsProviderName, EmbedOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class SiliconFlowEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "siliconflow";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.siliconflow.cn/v1/",
    model: "BAAI/bge-m3",
  };
}

export default SiliconFlowEmbeddingsProvider;
