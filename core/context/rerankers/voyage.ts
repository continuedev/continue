import fetch from "node-fetch";
import { Chunk, Reranker } from "../../index.js";

export class VoyageReranker implements Reranker {
  name = "voyage";

  constructor(
    private readonly params: {
      apiKey: string;
      model?: string;
      apiBase?: string;
    },
  ) {}

  private get apiBase() {
    return this.params.apiBase ?? "https://api.voyageai.com/v1/";
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || chunks.length === 0) {
      return [];
    }
    const url = new URL("rerank", this.apiBase);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.params.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.params.model ?? "rerank-2",
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
