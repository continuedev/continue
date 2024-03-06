import { EmbedOptions } from "../..";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class OpenAIEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.openai.com/v1",
    model: "text-embedding-3-small",
  };

  get id(): string {
    return "openai::" + this.options.model;
  }

  async embed(chunks: string[]) {
    let apiBase = this.options.apiBase;
    if (apiBase?.endsWith("/")) {
      apiBase = apiBase.slice(0, -1);
    }

    return await Promise.all(
      chunks.map(async (chunk) => {
        const resp = await fetch(`${apiBase}/embeddings`, {
          method: "POST",
          body: JSON.stringify({
            input: chunk,
            model: this.options.model,
          }),
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            "Content-Type": "application/json",
          },
        });
        const data = await resp.json();
        return data.data[0].embedding;
      }),
    );
  }
}

export default OpenAIEmbeddingsProvider;
