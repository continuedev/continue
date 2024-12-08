import fetch from "node-fetch";

import { Chunk, LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

export class HuggingFaceTEIReranker extends BaseLLM {
  static providerName = "huggingface-tei";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "http://localhost:8080",
    // truncate: true,
    // truncation_direction: "Right",
  };

  // constructor(
  //   private readonly params: {
  //     apiBase?: string;
  // TODO support truncate and truncate_direction
  //     truncate?: boolean;
  //     truncation_direction?: string;
  //     apiKey?: string;
  //   },
  // ) {}

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const resp = await fetch(new URL("rerank", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: query,
        return_text: false,
        raw_scores: false,
        texts: chunks.map((chunk) => chunk.content),
        truncation_direction: "Right",
        truncate: true,
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    // Resort into original order and extract scores
    const results = data.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.score);
  }
}
