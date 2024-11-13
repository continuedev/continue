import { Response } from "node-fetch";

import { EmbeddingsProviderName, EmbedOptions } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class NvidiaEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 96;

  static providerName: EmbeddingsProviderName = "nvidia";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://integrate.api.nvidia.com/v1/",
    model: "nvidia/nv-embedqa-mistral-7b-v2",
  };

  async embed(chunks: string[]) {

    if (!this.options.apiBase?.endsWith("/")) {
      this.options.apiBase += "/";
    }

    const batchedChunks = [];
    for (
      let i = 0;
      i < chunks.length;
      i += NvidiaEmbeddingsProvider.maxBatchSize
    ) {
      batchedChunks.push(
        chunks.slice(i, i + NvidiaEmbeddingsProvider.maxBatchSize),
      );
    }
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          if (batch.length === 0) {
            return [];
          }
      
          // Input list must be non empty and all elements must be non empty, therefore, for all empty elements replace it with a token
          const emptyToken = "[EMPTY]";
          for (let i = 0; i < batch.length; i++) {
            if (batch[i].trim() === "") {
              batch[i] = emptyToken;
            }
          }

          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              this.fetch(new URL("embeddings", this.options.apiBase), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.options.model,
                  input_type: "passage",
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
          return data.data.map(
            (result: { embedding: number[] }) => result.embedding,
          );
        }),
      )
    ).flat();
  }
}

export default NvidiaEmbeddingsProvider;
