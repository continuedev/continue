import fetch from "node-fetch";

import { Chunk, Reranker } from "../../index.js";

export class CohereReranker implements Reranker {
  name = "cohere";

  static defaultOptions = {
    apiBase: "https://api.cohere.ai/v1/",
    model: "rerank-english-v3.0",
  };

  constructor(
    private readonly params: {
      apiBase?: string;
      apiKey: string;
      model?: string;
    },
  ) {}

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    let apiBase = this.params.apiBase ?? CohereReranker.defaultOptions.apiBase;
    if (!apiBase.endsWith("/")) {
      apiBase += "/";
    }

    const resp = await fetch(new URL("rerank", apiBase), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.params.model ?? CohereReranker.defaultOptions.model,
        query,
        documents: chunks.map((chunk) => chunk.content),
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    const results = data.results.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}
