import { EmbedOptions } from "../..";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class OpenAIEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.openai.com",
  };

  async embed(chunks: string[]) {
    const resp = await fetch(`${this.options.apiBase}/v1/embeddings`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        Authorization: `Bearer: ${this.options.apiKey}`,
      },
    });
    return [] as number[][];
  }
}

export default OpenAIEmbeddingsProvider;
