import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class FunctionNetworkEmbeddingsProvider extends BaseLLM {
  static providerName = "function-network";
  static maxBatchSize = 128;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.function.network/v1/",
    model: "baai/bge-base-en-v1.5",
  };

  private _getEndpoint() {
    return new URL("embeddings", this.apiBase);
  }

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          if (batch.length === 0) {
            return [];
          }

          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              this.fetch(this._getEndpoint(), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.model,
                }),
                headers: {
                  Authorization: `Bearer ${this.apiKey}`,
                  "Content-Type": "application/json",
                },
              }),
            );
          const resp = await fetchWithBackoff();

          if (!resp.ok) {
            throw new Error(await resp.text());
          }

          const data = (await resp.json()) as any;
          return data.data.map(
            (result: { embedding: number[] }) => result.embedding,
          );
        }),
      )
    ).flat();
  }
}

export default FunctionNetworkEmbeddingsProvider;
