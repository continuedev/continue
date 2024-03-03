import path from "path";
import {
  env,
  pipeline,
} from "../../vendor/node_modules/@xenova/transformers/types/transformers";
import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";
const { parentPort } = require("worker_threads");

env.allowLocalModels = true;
env.allowRemoteModels = false;
if (typeof window === "undefined") {
  // The embeddings provider should just never be called in the browser
  env.localModelPath = path.join(__dirname, "..", "models");
}

class EmbeddingsPipeline {
  static task = "feature-extraction";
  static model = TransformersJsEmbeddingsProvider.ModelName;
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }

    return this.instance;
  }
}

parentPort.on("message", async (chunks) => {
  try {
    const extractor = await EmbeddingsPipeline.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
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

    parentPort.postMessage(outputs);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});
