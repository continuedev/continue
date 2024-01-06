import { EmbedOptions, EmbeddingsProvider } from "../..";

class BaseEmbeddingsProvider implements EmbeddingsProvider {
  options: EmbedOptions;
  static defaultOptions: Partial<EmbedOptions> | undefined = undefined;

  constructor(options: EmbedOptions) {
    this.options = {
      ...(this.constructor as typeof BaseEmbeddingsProvider).defaultOptions,
      ...options,
    };
  }

  embed(chunks: string[]): Promise<number[]> {
    throw new Error("Method not implemented.");
  }
}

export default BaseEmbeddingsProvider;
