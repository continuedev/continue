import { EmbedOptions, FetchFunction } from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

async function embedOne(
  chunk: string,
  options: EmbedOptions,
  customFetch: FetchFunction,
) {
  const fetchWithBackoff = () =>
    withExponentialBackoff<Response>(() =>
      customFetch(new URL("api/embeddings", options.apiBase), {
        method: "POST",
        body: JSON.stringify({
          model: options.model,
          prompt: chunk,
        }),
      }),
    );
  const resp = await fetchWithBackoff();
  if (!resp.ok) {
    throw new Error("Failed to embed chunk: " + (await resp.text()));
  }

  return (await resp.json()).embedding;
}

class OllamaEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "http://localhost:11434/",
  };

  get id(): string {
    return this.options.model ?? "ollama";
  }

  async embed(chunks: string[]) {
    const results: any = [];
    for (const chunk of chunks) {
      results.push(await embedOne(chunk, this.options, this.fetch));
    }
    return results;
  }
}

export default OllamaEmbeddingsProvider;
