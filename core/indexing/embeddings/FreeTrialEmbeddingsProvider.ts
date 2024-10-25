import { Response } from "node-fetch";
import { getHeaders } from "../../continueServer/stubs/headers.js";
import { TRIAL_PROXY_URL } from "../../control-plane/client.js";
import {
  EmbeddingsProviderName,
  EmbedOptions,
  FetchFunction,
} from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class FreeTrialEmbeddingsProvider extends BaseEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "free-trial";
  static maxBatchSize = 128;

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "voyage-code-2",
  };

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    super(options, fetch);
    this.options.model = FreeTrialEmbeddingsProvider.defaultOptions?.model;
    this.id = `${this.constructor.name}::${this.options.model}`;
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
            withExponentialBackoff<Response>(async () =>
              this.fetch(new URL("embeddings", TRIAL_PROXY_URL), {
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
