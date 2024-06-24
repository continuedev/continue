import fetch from "node-fetch";
import { Chunk, Reranker } from "../../index.js";

export class VoyageReranker implements Reranker {
  name = "voyage";

  constructor(
    private readonly params: {
      apiKey: string;
      model?: string;
    },
  ) {}

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const resp = await fetch("https://api.voyageai.com/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.params.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: chunks.map((chunk) => chunk.content),
        model: this.params.model ?? "rerank-1",
      }),
    });
    const data: any = await resp.json();
    const results = data.data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
