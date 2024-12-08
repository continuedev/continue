import { getHeaders } from "../../continueServer/stubs/headers.js";
import { TRIAL_PROXY_URL } from "../../control-plane/client.js";
import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class FreeTrialEmbeddingsProvider extends BaseLLM {
  static providerName = "free-trial";
  static maxBatchSize = 128;

  static defaultOptions: Partial<LLMOptions> | undefined = {
    model: "voyage-code-2",
  };

  constructor(options: LLMOptions) {
    super(options);
    this.embeddingId = `${this.constructor.name}::${this.model}`;
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
                  model: this.model,
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
