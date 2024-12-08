import { GoogleAuth } from "google-auth-library";

import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

/**
 * [View the Vertex Text Embedding docs.](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)
 */
class VertexEmbeddingsProvider extends BaseLLM {
  static providerName = "vertexai";
  declare apiBase: string;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    model: "text-embedding-004",
    maxEmbeddingBatchSize: 5,
    region: "us-central1",
  };

  private clientPromise = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  }).getClient();

  private static getDefaultApiBaseFrom(options: LLMOptions) {
    const { region, projectId } = options;
    if (!region || !projectId) {
      throw new Error(
        "region and projectId must be defined if apiBase is not provided",
      );
    }

    return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}`;
  }

  constructor(options: LLMOptions) {
    super(options);
    this.apiBase ??= VertexEmbeddingsProvider.getDefaultApiBaseFrom(options);
  }

  get urlPath(): string {
    return `/publishers/google/models/${this.model}:predict`;
  }

  async embed(chunks: string[]) {
    const client = await this.clientPromise;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error(
        "Could not get an access token. Set up your Google Application Default Credentials.",
      );
    }
    const batchedChunks = this.getBatchedChunks(chunks);

    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const fetchWithBackoff = () =>
            withExponentialBackoff<Response>(() =>
              this.fetch(new URL(this.apiBase + this.urlPath), {
                method: "POST",
                body: JSON.stringify({
                  instances: batch.map((chunk) => ({ content: chunk })),
                }),
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }),
            );
          const resp = await fetchWithBackoff();

          if (!resp.ok) {
            throw new Error(await resp.text());
          }

          const data = (await resp.json()) as any;
          return data.predictions.map(
            (prediction: any) => prediction.embeddings.values,
          );
        }),
      )
    ).flat();
  }
}
export default VertexEmbeddingsProvider;
