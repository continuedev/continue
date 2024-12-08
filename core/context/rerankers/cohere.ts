import fetch from "node-fetch";

import { Chunk } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

export class CohereReranker extends BaseLLM {
  static providerName = "cohere";

  static defaultOptions = {
    apiBase: "https://api.cohere.ai/v1/",
    model: "rerank-english-v3.0",
  };

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    let apiBase = this.apiBase ?? CohereReranker.defaultOptions.apiBase;
    if (!apiBase.endsWith("/")) {
      apiBase += "/";
    }

    const resp = await fetch(new URL("rerank", apiBase), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model ?? CohereReranker.defaultOptions.model,
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
