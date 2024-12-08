import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class OpenAIEmbeddingsProvider extends BaseLLM {
  static providerName = "openai";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.openai.com/v1/",
    model: "text-embedding-3-small",
    apiVersion: "2024-02-15-preview",
    // https://platform.openai.com/docs/api-reference/embeddings/create is 2048
    // but Voyage is 128
    maxEmbeddingBatchSize: 128,
  };

  private _getEndpoint() {
    if (!this.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option in config.json",
      );
    }

    if (this.apiType === "azure") {
      return new URL(
        `openai/deployments/${this.deployment}/embeddings?api-version=${this.apiVersion}`,
        this.apiBase,
      );
    }
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
                  "api-key": this.apiKey ?? "", // For Azure
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

export default OpenAIEmbeddingsProvider;
