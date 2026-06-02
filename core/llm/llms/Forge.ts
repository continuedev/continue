import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Forge extends OpenAI {
  static providerName = "forge";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.voxell.ai/v1/",
    model: "forge-pro",
    maxEmbeddingBatchSize: 128,
  };
}

export default Forge;
