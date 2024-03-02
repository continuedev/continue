import { EmbedOptions } from "../..";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

async function embedOne(chunk: string, options: EmbedOptions) {
  const resp = await fetch(`${options.apiBase}/api/embeddings`, {
    method: "POST",
    body: JSON.stringify({
      model: options.model,
      prompt: chunk,
    }),
  });

  if (!resp.ok) {
    throw new Error("Failed to embed chunk: " + (await resp.text()));
  }

  return (await resp.json()).embedding;
}

class OllamaEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "http://localhost:11434",
  };

  get id(): string {
    return "ollama::" + this.options.model;
  }

  async embed(chunks: string[]) {
    const results: any = [];
    for (const chunk of chunks) {
      results.push(await embedOne(chunk, this.options));
    }
    return results;
  }
}

export default OllamaEmbeddingsProvider;
