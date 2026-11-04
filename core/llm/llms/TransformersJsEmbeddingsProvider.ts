import path from "path";

import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

class EmbeddingsPipeline {
  static task = "feature-extraction" as const;
  static model = "all-MiniLM-L6-v2";
  static instance: any | null = null;

  /**
   * Directory that contains the `all-MiniLM-L6-v2` model folder. When unset it
   * is `<extension>/models`, next to the bundled `out/` directory. Tests that
   * run from the source tree point it at `extensions/vscode/models`.
   */
  static localModelPath: string | undefined = undefined;

  static async getInstance() {
    if (EmbeddingsPipeline.instance === null) {
      const { env, pipeline } = await import("@huggingface/transformers");

      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath =
        EmbeddingsPipeline.localModelPath ??
        path.join(
          typeof __dirname === "undefined"
            ? // @ts-ignore
              path.dirname(new URL(import.meta.url).pathname)
            : __dirname,
          "..",
          "models",
        );

      EmbeddingsPipeline.instance = await pipeline(
        EmbeddingsPipeline.task,
        EmbeddingsPipeline.model,
        // The bundled model is the 8-bit quantized export (onnx/model_quantized.onnx)
        { dtype: "q8" },
      );
    }

    return EmbeddingsPipeline.instance;
  }
}

export class TransformersJsEmbeddingsProvider extends BaseLLM {
  static providerName = "transformers.js";
  static maxGroupSize: number = 1;
  static model: string = "all-MiniLM-L6-v2";
  static mockVector: number[] = Array.from({ length: 384 }).fill(2) as number[];

  static defaultOptions: Partial<LLMOptions> | undefined = {
    model: TransformersJsEmbeddingsProvider.model,
  };

  /** Overrides the directory the embeddings model is loaded from (tests). */
  static setLocalModelPath(modelsDir: string | undefined) {
    EmbeddingsPipeline.localModelPath = modelsDir;
    EmbeddingsPipeline.instance = null;
  }

  constructor() {
    super({
      model: TransformersJsEmbeddingsProvider.model,
      title: "Transformers.js (Built-In)",
    });
  }

  async embed(chunks: string[]) {
    // Workaround to ignore testing issues in Jest
    if (process.env.NODE_ENV === "test") {
      return chunks.map(() => TransformersJsEmbeddingsProvider.mockVector);
    }

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
      i += TransformersJsEmbeddingsProvider.maxGroupSize
    ) {
      const chunkGroup = chunks.slice(
        i,
        i + TransformersJsEmbeddingsProvider.maxGroupSize,
      );
      const output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      // To avoid causing the extension host to go unresponsive
      await new Promise((resolve) => setTimeout(resolve, 10));
      outputs.push(...output.tolist());
    }
    return outputs;
  }
}

export default TransformersJsEmbeddingsProvider;
