import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class CohereEmbeddingsProvider extends BaseLLM {
  static maxBatchSize = 96;

  static providerName = "cohere";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    apiBase: "https://api.cohere.ai/v1/",
    model: "embed-english-v3.0",
  };

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              this.fetch(new URL("embed", this.apiBase), {
                method: "POST",
                body: JSON.stringify({
                  texts: batch,
                  model: this.model,
                  input_type: "search_document",
                  embedding_types: ["float"],
                  truncate: "END",
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
          return data.embeddings.float;
        }),
      )
    ).flat();
  }
}

export default CohereEmbeddingsProvider;
