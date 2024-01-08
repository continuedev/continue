import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

async function calculateEmbeddings(chunks: string[]) {
  const { env, pipeline } = require("@xenova/transformers");

  env.allowLocalModels = true;
  // env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.backends.onnx.wasm.wasmPaths = "/ort-wasm";
  console.log("chunks", chunks);
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
    // "Supabase/gte-small"
    // "TaylorAI/gte-tiny"
    // "https://huggingface.co/Xenova/all-MiniLM-L6-v2/raw/main/onnx/model_quantized.onnx"
  );
  console.log("extractor", extractor);
  const results = await extractor(chunks, {
    pooling: "mean",
    normalize: true,
  });
  console.log(results);
  return results.tolist();
}

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  constructor() {
    super({ model: "all-MiniLM-L2-v6" });
  }

  embed(chunks: string[]) {
    return calculateEmbeddings(chunks);
  }
}

export default TransformersJsEmbeddingsProvider;
