import { EmbedOptions, EmbeddingsProvider, FetchFunction } from "../../index.js";

export interface IBaseEmbeddingsProvider extends EmbeddingsProvider {
  options: EmbedOptions;
  fetch: FetchFunction;
  static defaultOptions: Partial<EmbedOptions> | undefined = undefined;

abstract class BaseEmbeddingsProvider implements IBaseEmbeddingsProvider {
  static maxBatchSize: IBaseEmbeddingsProvider["maxBatchSize"];
  static defaultOptions: IBaseEmbeddingsProvider["defaultOptions"];

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    this.options = {
      ...(this.constructor as typeof BaseEmbeddingsProvider).defaultOptions,
      ...options,
    };
    this.fetch = fetch;
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
