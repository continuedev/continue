import {
  EmbedOptions,
  EmbeddingsProvider,
  FetchFunction,
} from "../../index.js";

export interface IBaseEmbeddingsProvider extends EmbeddingsProvider {
  options: EmbedOptions;
  fetch: FetchFunction;
  defaultOptions?: EmbedOptions;
  maxBatchSize?: number;
}

abstract class BaseEmbeddingsProvider implements IBaseEmbeddingsProvider {
  static maxBatchSize: IBaseEmbeddingsProvider["maxBatchSize"];
  static defaultOptions: IBaseEmbeddingsProvider["defaultOptions"];

  options: IBaseEmbeddingsProvider["options"];
  fetch: IBaseEmbeddingsProvider["fetch"];
  id: IBaseEmbeddingsProvider["id"];

  constructor(
    options: IBaseEmbeddingsProvider["options"],
    fetch: IBaseEmbeddingsProvider["fetch"],
  ) {
    // Overwrite default options with any runtime options
    this.options = {
      ...(this.constructor as typeof BaseEmbeddingsProvider).defaultOptions,
      ...options,
    };
    this.fetch = fetch;
    this.id = `${this.constructor.name}::${this.options.model}`;
  }

  abstract embed(chunks: string[]): Promise<number[][]>;

  static getBatchedChunks(chunks: string[]): string[][] {
    if (!this.maxBatchSize) {
      console.warn(
        `${this.getBatchedChunks.name} should only be called if 'maxBatchSize' is defined`,
      );

      return [chunks];
    }

    if (chunks.length > this.maxBatchSize) {
      return [chunks];
    }

    const batchedChunks = [];

    for (let i = 0; i < chunks.length; i += this.maxBatchSize) {
      const batchSizedChunk = chunks.slice(i, i + this.maxBatchSize);
      batchedChunks.push(batchSizedChunk);
    }

    return batchedChunks;
  }
}

export default BaseEmbeddingsProvider;
