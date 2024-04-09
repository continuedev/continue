import { EmbedOptions } from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { SERVER_URL } from "../../util/parameters";
import { withExponentialBackoff } from "../../util/withExponentialBackoff";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class FreeTrialEmbeddingsProvider extends BaseEmbeddingsProvider {
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "voyage-code-2",
  };

  get id(): string {
    return FreeTrialEmbeddingsProvider.defaultOptions!.model!;
  }

  async embed(chunks: string[]) {
    return await Promise.all(
      chunks.map(async (chunk) => {
        const fetchWithBackoff = () =>
          withExponentialBackoff<Response>(() =>
            fetch(new URL("embeddings", SERVER_URL).toString(), {
              method: "POST",
              body: JSON.stringify({
                input: chunk,
                model: this.options.model,
              }),
              headers: {
                "Content-Type": "application/json",
                ...getHeaders(),
              },
            }),
          );
        const resp = await fetchWithBackoff();
        const data = await resp.json();
        return data.embedding;
      }),
    );
  }
}

export default FreeTrialEmbeddingsProvider;
