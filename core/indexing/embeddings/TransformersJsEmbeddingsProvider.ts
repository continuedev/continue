import path from "path";
// @ts-ignore
// prettier-ignore
import { type PipelineType } from "../../vendor/modules/@xenova/transformers/src/transformers.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class EmbeddingsPipeline {
  static task: PipelineType = "feature-extraction";
  static model = "all-MiniLM-L6-v2";
  static instance: any | null = null;

  static async getInstance() {
    if (EmbeddingsPipeline.instance === null) {
      // @ts-ignore
      // prettier-ignore
      const { env, pipeline } = await import("../../vendor/modules/@xenova/transformers/src/transformers.js");

      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = path.join(__dirname, "..", "models");

      EmbeddingsPipeline.instance = await pipeline(
        EmbeddingsPipeline.task,
        EmbeddingsPipeline.model,
      );
    }

    return EmbeddingsPipeline.instance;
  }
}

export class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  static MaxGroupSize: number = 4;

  constructor(modelPath?: string) {
    super({ model: "all-MiniLM-L2-v6" }, () => Promise.resolve(null));
    if (modelPath) {
      // env.localModelPath = modelPath;
    }
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
