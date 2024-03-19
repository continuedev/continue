import { EmbedOptions } from "../..";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class OpenAIEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    apiBase: "https://api.openai.com/v1/",
    model: "text-embedding-3-small",
  };

  get id(): string {
    return this.options.model ?? "openai";
  }

  async embed(chunks: string[]) {
    return await Promise.all(
      chunks.map(async (chunk) => {
        const fetchWithBackoff = () =>
          withExponentialBackoff<Response>(() =>
            fetch(new URL("embeddings", this.options.apiBase).toString(), {
              method: "POST",
              body: JSON.stringify({
                input: chunk,
                model: this.options.model,
              }),
              headers: {
                Authorization: `Bearer ${this.options.apiKey}`,
                "Content-Type": "application/json",
              },
            }),
          );
        const resp = await fetchWithBackoff();
        const data = await resp.json();
        return data.data[0].embedding;
      }),
    );
  }
}

export default OpenAIEmbeddingsProvider;
