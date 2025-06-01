import { Chunk, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Morph extends OpenAI {
  static providerName = "morph";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.morphllm.com/v1",
    maxEmbeddingBatchSize: 96,
  };
  static maxStopSequences = 5;

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const resp = await this.fetch(new URL("rerank", this.apiBase), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
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
export default Morph;
