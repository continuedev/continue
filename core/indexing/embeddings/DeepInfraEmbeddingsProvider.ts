import { EmbedOptions } from "../..";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";
import { fetchWithExponentialBackoff } from "./util";

class DeepInfraEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "sentence-transformers/all-MiniLM-L6-v2",
  };

  get id(): string {
    return this.options.model ?? "deepinfra";
  }

  async embed(chunks: string[]) {
    const resp = await fetchWithExponentialBackoff(
      `https://api.deepinfra.com/v1/inference/${this.options.model}`,
      {
        method: "POST",
        headers: {
          Authorization: `bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({ inputs: chunks }),
      },
    );
    const data = await resp.json();
    return data.embeddings;
  }
}

export default DeepInfraEmbeddingsProvider;
