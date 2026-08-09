import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Nvidia extends OpenAI {
  // NVIDIA NIMs currently limits the number of stops for Starcoder 2 to 4
  // https://docs.api.nvidia.com/nim/reference/bigcode-starcoder2-7b-infer
  maxStopWords = 4;
  static providerName = "nvidia";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    useLegacyCompletionsEndpoint: false,
    maxEmbeddingBatchSize: 96,
  };

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const resp = await this.fetch(new URL("embeddings", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        input: chunks,
        model: this.model,
        input_type: "passage",
        truncate: "END",
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    return data.data.map((result: { embedding: number[] }) => result.embedding);
  }
}

export default Nvidia;
