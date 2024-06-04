import { Response } from "node-fetch";
import { getHeaders } from "../../continueServer/stubs/headers.js";
import { EmbedOptions } from "../../index.js";
import { SERVER_URL } from "../../util/parameters.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class FreeTrialEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 128;
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "voyage-code-2",
  };

  get id(): string {
    return FreeTrialEmbeddingsProvider.defaultOptions?.model!;
  }

  async embed(chunks: string[]) {
    const batchedChunks = [];
    for (
      let i = 0;
      i < chunks.length;
      i += FreeTrialEmbeddingsProvider.maxBatchSize
    ) {
      batchedChunks.push(
        chunks.slice(i, i + FreeTrialEmbeddingsProvider.maxBatchSize),
      );
    }
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(async () =>
              this.fetch(new URL("embeddings", SERVER_URL), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.options.model,
                }),
                headers: {
                  "Content-Type": "application/json",
                  ...(await getHeaders()),
                },
              }),
            );
          const resp = await fetchWithBackoff();

          if (resp.status !== 200) {
            throw new Error(
              `Failed to embed: ${resp.status} ${await resp.text()}`,
            );
          }

          const data = (await resp.json()) as any;
          return data.embeddings;
        }),
      )
    ).flat();
  }
}

export default FreeTrialEmbeddingsProvider;
