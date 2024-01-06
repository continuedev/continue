import { env, pipeline } from "@xenova/transformers";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider";

env.allowLocalModels = false;
env.useBrowserCache = false;

async function calculateEmbeddings(chunks: string[]) {
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
    // "Supabase/gte-small"
    // "TaylorAI/gte-tiny"
    // "https://huggingface.co/Xenova/all-MiniLM-L6-v2/raw/main/onnx/model_quantized.onnx"
  );
  const results = await extractor(chunks, {
    pooling: "mean",
    normalize: true,
  });
  console.log(results);
  return results.tolist();
}

class TransformersJsEmbeddingsProvider extends BaseEmbeddingsProvider {
  embed(chunks: string[]) {
    return calculateEmbeddings(chunks);
  }
}

export default TransformersJsEmbeddingsProvider;
