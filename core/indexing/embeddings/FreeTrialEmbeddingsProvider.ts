import fetch, { Response } from "node-fetch";
import { EmbedOptions } from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { SERVER_URL } from "../../util/parameters";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class FreeTrialEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 128;
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "voyage-code-2",
  };

  get id(): string {
    return FreeTrialEmbeddingsProvider.defaultOptions!.model!;
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
            withExponentialBackoff<Response>(() =>
              fetch(new URL("embeddings", SERVER_URL), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.options.model,
                }),
                headers: {
                  "Content-Type": "application/json",
                  ...getHeaders(),
                },
              }),
            );
          const resp = await fetchWithBackoff();
          const data = (await resp.json()) as any;
          return data.embeddings;
        }),
      )
    ).flat();
  }
}

export default FreeTrialEmbeddingsProvider;
