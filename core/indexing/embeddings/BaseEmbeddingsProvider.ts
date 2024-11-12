import {
  EmbedOptions,
  EmbeddingsProvider,
  EmbeddingsProviderName,
  FetchFunction,
} from "../../index.js";
import { DEFAULT_MAX_CHUNK_SIZE } from "../../llm/constants.js";

export interface IBaseEmbeddingsProvider extends EmbeddingsProvider {
  options: EmbedOptions;
  fetch: FetchFunction;
  defaultOptions?: EmbedOptions;
  maxBatchSize?: number;
}

abstract class BaseEmbeddingsProvider implements IBaseEmbeddingsProvider {
  static maxBatchSize: IBaseEmbeddingsProvider["maxBatchSize"];
  static defaultOptions: IBaseEmbeddingsProvider["defaultOptions"];

  static providerName: EmbeddingsProviderName;
  get providerName(): EmbeddingsProviderName {
    return (this.constructor as typeof BaseEmbeddingsProvider).providerName;
  }

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
    // Include the `max_chunk_size` if it is not the default, since we need to create other indices for different chunk_sizes
    if (this.maxChunkSize !== DEFAULT_MAX_CHUNK_SIZE) {
      this.id = `${this.constructor.name}::${this.options.model}::${this.maxChunkSize}`;
    } else {
      this.id = `${this.constructor.name}::${this.options.model}`;
    }
  }
  defaultOptions?: EmbedOptions | undefined;
  get maxBatchSize(): number | undefined {
    return this.options.maxBatchSize ?? (this.constructor as typeof BaseEmbeddingsProvider).maxBatchSize;
  }

  abstract embed(chunks: string[]): Promise<number[][]>;

  get maxChunkSize(): number {
    return this.options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  }

  getBatchedChunks(chunks: string[]): string[][] {
    if (!this.maxBatchSize) {
      console.warn(
        `${this.getBatchedChunks.name} should only be called if 'maxBatchSize' is defined`,
      );

      return [chunks];
    }

    const batchedChunks = [];

    for (let i = 0; i < chunks.length; i += this.maxBatchSize) {
      batchedChunks.push(chunks.slice(i, i + this.maxBatchSize));
    }

    return batchedChunks;
  }
}

export default BaseEmbeddingsProvider;
