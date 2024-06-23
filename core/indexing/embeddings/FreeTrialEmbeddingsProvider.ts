import { Response } from "node-fetch";
import { getHeaders } from "../../continueServer/stubs/headers.js";
import { constants } from "../../deploy/constants.js";
import { EmbedOptions, FetchFunction } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class FreeTrialEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 128;

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "voyage-code-2",
  };

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    super(options, fetch);
    this.options.model = FreeTrialEmbeddingsProvider.defaultOptions?.model;
    this.id = this.options.model || this.constructor.name;
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
              this.fetch(new URL("embeddings", constants.a), {
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
