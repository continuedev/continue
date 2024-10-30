import {
  EmbeddingsProviderName,
  EmbedOptions,
  FetchFunction,
} from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider, {
  IBaseEmbeddingsProvider,
} from "./BaseEmbeddingsProvider.js";

async function embedOneBatch(
  chunks: string[],
  options: EmbedOptions,
  customFetch: FetchFunction,
) {
  const embedding = await withExponentialBackoff<number[][]>(async () => {
    let apiBase = options.apiBase!;

    if (!apiBase.endsWith("/")) {
      apiBase += "/";
    }

    const resp = await customFetch(new URL("api/embed", apiBase), {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        input: chunks,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to embed chunk: ${await resp.text()}`);
    }

    const data = await resp.json();
    const embedding: number[][] = data.embeddings;

    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama generated empty embedding");
    }
    return embedding;
  });

  return embedding;
}

class OllamaEmbeddingsProvider extends BaseEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "ollama";
  static defaultOptions: IBaseEmbeddingsProvider["defaultOptions"] = {
    apiBase: "http://localhost:11434/",
    model: "nomic-embed-text",
    maxBatchSize: 64,
  };

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);
    var results: number[][] = [];

    for (const batch of batchedChunks) {
      results.push(...await embedOneBatch(batch, this.options, this.fetch));
    }
    return results;
  }
}

export default OllamaEmbeddingsProvider;
