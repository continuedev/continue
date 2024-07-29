import {
  EmbeddingsProviderName,
  EmbedOptions,
  FetchFunction,
} from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider, {
  IBaseEmbeddingsProvider,
} from "./BaseEmbeddingsProvider.js";

async function embedOne(
  chunk: string,
  options: EmbedOptions,
  customFetch: FetchFunction,
) {
  const embedding = await withExponentialBackoff<number[]>(async () => {
    let apiBase = options.apiBase!;

    if (!apiBase.endsWith("/")) {
      apiBase += "/";
    }

    const resp = await customFetch(new URL("api/embeddings", apiBase), {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        prompt: chunk,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to embed chunk: ${await resp.text()}`);
    }

    const data = await resp.json();
    const embedding = data.embedding;

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
  };

  async embed(chunks: string[]) {
    const results: any = [];
    for (const chunk of chunks) {
      results.push(await embedOne(chunk, this.options, this.fetch));
    }
    return results;
  }
}

export default OllamaEmbeddingsProvider;
