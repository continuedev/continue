import BaseEmbeddingsProvider from "core/index/embeddings/BaseEmbeddingsProvider";
import { v4 as uuidv4 } from "uuid";

let worker: Worker | null = null;

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  constructor() {
    super({ model: "all-MiniLM-L2-v6" });
  }

  embed(chunks: string[]) {
    return new Promise<number[][]>(async (resolve) => {
      if (!worker) {
        const resp = await fetch("/worker.js");
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        worker = new Worker(blobUrl, {
          type: "module",
        });

        worker.postMessage(
          JSON.stringify({
            type: "init",
            vscMediaUrl: (window as any).vscMediaUrl,
          })
        );
      }
      let id = uuidv4();
      const onMessageReceived = (e: any) => {
        if (e.data.type === "embeddings" && e.data.id === id) {
          worker?.removeEventListener("message", onMessageReceived);
          resolve(e.data.embeddings);
        }
      };
      worker.addEventListener("message", onMessageReceived);
      worker.postMessage(
        JSON.stringify({
          chunks,
          id,
          type: "embeddings",
        })
      );
    });
  }
}

export default TransformersJsEmbeddingsProvider;
