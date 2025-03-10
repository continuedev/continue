import { Chunk, LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Voyage extends OpenAI {
  static providerName = "voyage";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.voyageai.com/v1/",
    maxEmbeddingBatchSize: 128,
  };

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || chunks.length === 0) {
      return [];
    }
    const url = new URL("rerank", this.apiBase);
    const resp = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.model ?? "rerank-2",
      }),
    });

    if (resp.status !== 200) {
      throw new Error(
        `VoyageReranker API error ${resp.status}: ${await resp.text()}`,
      );
    }

    const data = (await resp.json()) as {
      data: Array<{ index: number; relevance_score: number }>;
    };
    const results = data.data.sort((a, b) => a.index - b.index);
    return results.map((result) => result.relevance_score);
  }
}

export default Voyage;
