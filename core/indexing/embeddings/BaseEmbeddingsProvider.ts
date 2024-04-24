import { EmbedOptions, EmbeddingsProvider, FetchFunction } from "../..";

class BaseEmbeddingsProvider implements EmbeddingsProvider {
  options: EmbedOptions;
  fetch: FetchFunction;
  static defaultOptions: Partial<EmbedOptions> | undefined = undefined;

  get id(): string {
    throw new Error("Method not implemented.");
  }

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    this.options = {
      ...(this.constructor as typeof BaseEmbeddingsProvider).defaultOptions,
      ...options,
    };
    this.fetch = fetch;
  }

  embed(chunks: string[]): Promise<number[][]> {
    throw new Error("Method not implemented.");
  }
}

export default BaseEmbeddingsProvider;
