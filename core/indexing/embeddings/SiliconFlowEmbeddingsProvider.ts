import { LLMOptions } from "../..";

import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class SiliconFlowEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  static providerName = "siliconflow";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.siliconflow.cn/v1/",
    model: "BAAI/bge-m3",
  };
}

export default SiliconFlowEmbeddingsProvider;
