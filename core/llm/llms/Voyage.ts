import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Voyage extends OpenAI {
  static providerName = "voyage";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.voyageai.com/v1/",
    model: "voyage-code-2",
    maxEmbeddingBatchSize: 128,
  };
}

export default Voyage;
