import fetch, { Response } from "node-fetch";
import { EmbedOptions } from "../..";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class OpenAIEmbeddingsProvider extends BaseEmbeddingsProvider {
  // https://platform.openai.com/docs/api-reference/embeddings/create is 2048
  // but Voyage is 128
  static maxBatchSize = 128;

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.openai.com/v1/",
    model: "text-embedding-3-small",
  };

  get id(): string {
    return this.options.model ?? "openai";
  }

  async embed(chunks: string[]) {
    if (!this.options.apiBase?.endsWith("/")) {
      this.options.apiBase += "/";
    }

    const batchedChunks = [];
    for (
      let i = 0;
      i < chunks.length;
      i += OpenAIEmbeddingsProvider.maxBatchSize
    ) {
      batchedChunks.push(
        chunks.slice(i, i + OpenAIEmbeddingsProvider.maxBatchSize),
      );
    }
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              fetch(new URL("embeddings", this.options.apiBase), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.options.model,
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

export default OpenAIEmbeddingsProvider;
