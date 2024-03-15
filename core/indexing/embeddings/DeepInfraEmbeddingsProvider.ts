import { EmbedOptions } from "../..";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";

class DeepInfraEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "sentence-transformers/all-MiniLM-L6-v2",
  };

  get id(): string {
    return "deepinfra::" + this.options.model;
  }

  async embed(chunks: string[]) {
    const fetchWithBackoff = () =>
      withExponentialBackoff<Response>(() =>
        fetch(`https://api.deepinfra.com/v1/inference/${this.options.model}`, {
          method: "POST",
          headers: {
            Authorization: `bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({ inputs: chunks }),
        })
      );
    const resp = await fetchWithBackoff();
    const data = await resp.json();
    console.log(data);
    return data.embeddings;
  }
}

export default DeepInfraEmbeddingsProvider;
