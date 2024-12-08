import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class OllamaEmbeddingsProvider extends BaseLLM {
  static providerName = "ollama";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "http://localhost:11434/",
    model: "nomic-embed-text",
    maxEmbeddingBatchSize: 64,
  };

  async embedOneBatch(chunks: string[]) {
    const embedding = await withExponentialBackoff<number[][]>(async () => {
      const resp = await this.fetch(new URL("api/embed", this.apiBase), {
        method: "POST",
        body: JSON.stringify({
          model: this.model,
          input: chunks,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!resp.ok) {
        throw new Error(`Failed to embed chunk: ${await resp.text()}`);
      }

      const data = await resp.json();
      const embedding: number[][] = data.embeddings;

      if (!embedding || embedding.length === 0) {
        throw new Error("Ollama generated empty embedding");
      }
      return embedding;
    });

    return embedding;
  }

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);
    var results: number[][] = [];

    for (const batch of batchedChunks) {
      results.push(...(await this.embedOneBatch(batch)));
    }
    return results;
  }
}

export default OllamaEmbeddingsProvider;
