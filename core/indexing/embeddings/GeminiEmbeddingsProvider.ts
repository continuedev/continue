import { Response } from "node-fetch";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider, {
  IBaseEmbeddingsProvider,
} from "./BaseEmbeddingsProvider.js";
import {
  EmbedContentRequest,
  EmbedContentResponse,
} from "@google/generative-ai";

/**
 * [View the Gemini Text Embedding docs.](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding)
 */
class GeminiEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 2048;

  static defaultOptions = {
    apiBase: "https://generativelanguage.googleapis.com/v1/",
    model: "models/text-embedding-004",
  };

  get urlPath(): string {
    return `${this.options.model}:embedContent`;
  }

  async getSingleBatchEmbedding(batch: string[]) {
    const body: EmbedContentRequest = {
      content: {
        /**
         * Listed as optional in the [docs](https://ai.google.dev/api/rest/v1/Content)
         * but is required in the interface.
         */
        role: "user",
        parts: batch.map((part) => ({ text: part })),
      },
    };

    const fetchWithBackoff = () =>
      withExponentialBackoff<Response>(() =>
        this.fetch(new URL(this.urlPath, this.options.apiBase), {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "x-goog-api-key": this.options.apiKey,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
          },
        }),
      );

    const resp = await fetchWithBackoff();

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as EmbedContentResponse;

    return data.embedding.values;
  }

  async embed(chunks: string[]) {
    const batches = GeminiEmbeddingsProvider.getBatchedChunks(chunks);

    return await Promise.all(
      batches.map((batch) => this.getSingleBatchEmbedding(batch)),
    );
  }
}

export default GeminiEmbeddingsProvider;
