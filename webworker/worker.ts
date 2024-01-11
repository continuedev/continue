import { PipelineType, env, pipeline } from "@xenova/transformers";

// --- Allow web worker to fetch from the same origin
let _fetch = self.fetch;

function handleInit(e: any) {
  const data = JSON.parse(e.data);
  if (data.type === "init") {
    self.fetch = function proxyFetch(
      url: string,
      init?: RequestInit
    ): Promise<Response> {
      if (!(url.startsWith("http://") || url.startsWith("https://"))) {
        const fullUrl = `${data.vscMediaUrl}/${url}`;
        return _fetch(fullUrl, init);
      }

      return _fetch(url, init);
    };

    self.removeEventListener("message", handleInit);
  }
}
self.addEventListener("message", handleInit);

// ---

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false; // Doesn't work with web workers (only in VS Code?)
env.backends.onnx.wasm.wasmPaths = "ort-wasm/";

class EmbeddingsPipeline {
  static task: PipelineType = "feature-extraction";
  static model = "all-MiniLM-L6-v2";
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }

    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const data = JSON.parse(event.data);
  if (data.type !== "embeddings") {
    return;
  }

  let extractor = await EmbeddingsPipeline.getInstance();

  let output = await extractor(data.chunks, {
    pooling: "mean",
    normalize: true,
  });

  // Send the output back to the main thread
  self.postMessage({
    embeddings: output.tolist(),
    id: data.id,
    type: "embeddings",
  });
});
