import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  providerName: string = "transformers.js";

  constructor() {
    super({ model: "all-MiniLM-L2-v6" });
  }

  embed(chunks: string[]) {
    throw new Error(
      "TransformersJsEmbeddingsProvider is only available in the browser"
    );

    return Promise.resolve([]);
  }
}

export default TransformersJsEmbeddingsProvider;
