import {
  PipelineType,
  env,
  pipeline,
} from "../../vendor/node_modules/@xenova/transformers";

import path from "path";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";
import { Worker } from "worker_threads";

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
    return "sentence-transformers/all-MiniLM-L6-v2";
  }

  async getInstance() {
    return await EmbeddingsPipeline.getInstance();
  }

  async embed(chunks: string[]) {
    return new Promise<number[][]>((resolve, reject) => {
      const desiredDirectory = path.join(__dirname, "worker.js");
      const worker = new Worker(desiredDirectory);
      worker.on("message", (transcode_data) => {
        resolve(transcode_data);
        worker.terminate();
      });

      worker.on("error", (err) => {
        console.error(err);
        reject(err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Encoding stopped with exit code [ ${code} ]`));
        }
      });

      worker.postMessage(chunks);
    });
  }
}

export default TransformersJsEmbeddingsProvider;
