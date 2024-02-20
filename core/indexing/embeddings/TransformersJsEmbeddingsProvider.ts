import { Worker } from "worker_threads";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  static MaxGroupSize: number = 4;
  static ModelName: string = "all-MiniLM-L2-v6";

  constructor() {
    super({ model: TransformersJsEmbeddingsProvider.ModelName });
  }

  get id(): string {
    return "transformers-js";
  }

  async embed(chunks: string[]) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("./TransformersJsWorkerThread.js");

      worker.postMessage(chunks);

      worker.on("message", (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      });

      worker.on("error", reject);

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    }) as any;
  }
}

export default TransformersJsEmbeddingsProvider;
