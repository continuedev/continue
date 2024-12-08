import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

class DeepInfraEmbeddingsProvider extends BaseLLM {
  static providerName = "deepinfra";
  static defaultOptions: Partial<LLMOptions> | undefined = {
    model: "sentence-transformers/all-MiniLM-L6-v2",
  };

  async embed(chunks: string[]) {
    const fetchWithBackoff = () =>
      withExponentialBackoff<Response>(() =>
        this.fetch(`https://api.deepinfra.com/v1/inference/${this.model}`, {
          method: "POST",
          headers: {
            Authorization: `bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ inputs: chunks }),
        }),
      );
    const resp = await fetchWithBackoff();
    const data = await resp.json();
    return data.embeddings;
  }
}

export default DeepInfraEmbeddingsProvider;
