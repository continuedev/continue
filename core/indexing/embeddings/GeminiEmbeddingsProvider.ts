import { Response } from "node-fetch";

import { EmbeddingsProviderName } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

/**
 * [View the Gemini Text Embedding docs.](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding)
 */
class GeminiEmbeddingsProvider extends BaseEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "gemini";
  static maxBatchSize = 100;

  static defaultOptions = {
    apiBase: "https://generativelanguage.googleapis.com/v1/",
    model: "models/text-embedding-004",
  };

  get urlPath(): string {
    return `${this.options.model}:batchEmbedContents`;
  }

  async getSingleBatchEmbedding(batch: string[]) {
    // Batch embed endpoint: https://ai.google.dev/api/embeddings?authuser=1#EmbedContentRequest
    const requests = batch.map((text) => ({
      model: this.options.model,
      content: {
        role: "user",
        parts: [{ text }],
      },
    }));

    const fetchWithBackoff = () =>
      withExponentialBackoff<Response>(() =>
        this.fetch(new URL(this.urlPath, this.options.apiBase), {
          method: "POST",
          body: JSON.stringify({
            requests,
          }),
          headers: {
            "x-goog-api-key": this.options.apiKey,
            "Content-Type": "application/json",
          },
        }),
      );

    const resp = await fetchWithBackoff();

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;

    return data.embeddings.map((embedding: any) => embedding.values);
  }

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);

    const results = await Promise.all(
      batchedChunks.map((batch) => this.getSingleBatchEmbedding(batch)),
    );
    return results.flat();
  }
}

export default GeminiEmbeddingsProvider;
