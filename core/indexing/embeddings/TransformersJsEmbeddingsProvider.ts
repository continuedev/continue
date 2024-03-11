import {
  PipelineType,
  env,
  pipeline,
} from "../../vendor/node_modules/@xenova/transformers";

import path from "path";
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
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }

    return this.instance;
  }
}

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  static MaxGroupSize: number = 4;

  constructor() {
    super({ model: "all-MiniLM-L2-v6" });
  }

  get id(): string {
    return "transformers-js";
  }

  async embed(chunks: string[]) {
    let extractor = await EmbeddingsPipeline.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
    }

    if (chunks.length === 0) {
      return [];
    }

    let outputs = [];
    for (
      let i = 0;
      i < chunks.length;
      i += TransformersJsEmbeddingsProvider.MaxGroupSize
    ) {
      let chunkGroup = chunks.slice(
        i,
        i + TransformersJsEmbeddingsProvider.MaxGroupSize,
      );
      let output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      outputs.push(...output.tolist());
    }
    return outputs;
  }
}

export default TransformersJsEmbeddingsProvider;
