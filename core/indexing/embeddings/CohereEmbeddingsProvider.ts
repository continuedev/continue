import { Response } from "node-fetch";

import { EmbeddingsProviderName, EmbedOptions } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class CohereEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 96;

  static providerName: EmbeddingsProviderName = "cohere";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.cohere.ai/v1/",
    model: "embed-english-v3.0",
  };

  async embed(chunks: string[]) {
    if (!this.options.apiBase?.endsWith("/")) {
      this.options.apiBase += "/";
    }

    const batchedChunks = this.getBatchedChunks(chunks);
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              this.fetch(new URL("embed", this.options.apiBase), {
                method: "POST",
                body: JSON.stringify({
                  texts: batch,
                  model: this.options.model,
                  input_type: "search_document",
                  embedding_types: ["float"],
                  truncate: "END",
                }),
                headers: {
                  Authorization: `Bearer ${this.options.apiKey}`,
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
