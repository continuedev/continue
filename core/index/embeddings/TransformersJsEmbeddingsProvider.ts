import { PipelineType, env, pipeline } from "@xenova/transformers";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

env.allowLocalModels = true;
env.allowRemoteModels = false;
if (typeof window === "undefined") {
  // The embeddings provider should just never be called in the browser
  env.localModelPath = `${__dirname}../../models`;
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

    let output = await extractor(chunks, {
      pooling: "mean",
      normalize: true,
    });

    return output.tolist();
  }
}

export default TransformersJsEmbeddingsProvider;
