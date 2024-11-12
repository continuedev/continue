import { Response } from "node-fetch";

import { EmbeddingsProviderName, EmbedOptions } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class OpenAIEmbeddingsProvider extends BaseEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "openai";
  // https://platform.openai.com/docs/api-reference/embeddings/create is 2048
  // but Voyage is 128
  static maxBatchSize = 128;

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.openai.com/v1/",
    model: "text-embedding-3-small",
    apiVersion: "2024-02-15-preview",
  };

  private _getEndpoint() {
    if (!this.options.apiBase) {
      throw new Error(
        "No API base URL provided. Please set the 'apiBase' option in config.json",
      );
    }

    this.options.apiBase = this.options.apiBase.endsWith("/")
      ? this.options.apiBase
      : `${this.options.apiBase}/`;

    if (this.options.apiType === "azure") {
      return new URL(
        `openai/deployments/${this.options.deployment}/embeddings?api-version=${this.options.apiVersion}`,
        this.options.apiBase,
      );
    }
    return new URL("embeddings", this.options.apiBase);
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
            withExponentialBackoff<Response>(() =>
              this.fetch(this._getEndpoint(), {
                method: "POST",
                body: JSON.stringify({
                  input: batch,
                  model: this.options.model,
                }),
                headers: {
                  Authorization: `Bearer ${this.options.apiKey}`,
                  "Content-Type": "application/json",
                  "api-key": this.options.apiKey ?? "", // For Azure
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
