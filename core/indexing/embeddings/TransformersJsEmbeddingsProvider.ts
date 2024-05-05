import {
  env,
  pipeline,
  type PipelineType,
} from "../../vendor/node_modules/@xenova/transformers";

import path from "node:path";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

env.allowLocalModels = true;
env.allowRemoteModels = false;
if (typeof window === "undefined") {
  // The embeddings provider should just never be called in the browser
  env.localModelPath = path.join(__dirname, "..", "models");
}

class EmbeddingsPipeline {
  static task: PipelineType = "feature-extraction";
  static model = "all-MiniLM-L6-v2";
  static instance: any | null = null;

  static async getInstance() {
    if (EmbeddingsPipeline.instance === null) {
      EmbeddingsPipeline.instance = await pipeline(
        EmbeddingsPipeline.task,
        EmbeddingsPipeline.model,
      );
    }

    return EmbeddingsPipeline.instance;
  }
}

export class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  static MaxGroupSize = 4;

  constructor() {
    super({ model: EmbeddingsPipeline.model }, () => Promise.resolve(null));
  }

  get id(): string {
    return EmbeddingsPipeline.model;
  }

  async embed(chunks: string[]) {
    const extractor = await EmbeddingsPipeline.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
    }

    if (chunks.length === 0) {
      return [];
    }

    const outputs = [];
    for (
      let i = 0;
      i < chunks.length;
      i += TransformersJsEmbeddingsProvider.MaxGroupSize
    ) {
      const chunkGroup = chunks.slice(
        i,
        i + TransformersJsEmbeddingsProvider.MaxGroupSize,
      );
      const output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      outputs.push(...output.tolist());
    }
    return outputs;
  }
}

export default TransformersJsEmbeddingsProvider;
