import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
const { parentPort } = require("worker_threads");

parentPort.on("message", async (chunks: any[]) => {
  try {
    console.log("extractor inside worker thread", chunks);
    const extractorOne = new TransformersJsEmbeddingsProvider();
    const extractor = await extractorOne.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
    }

    let outputs = [];
    for (let i = 0; i < chunks.length; i += 4) {
      let chunkGroup = chunks.slice(i, i + 4);
      let output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      outputs.push(...output.tolist());
    }

    parentPort.postMessage(outputs);
    parentPort.close();
  } catch (error: unknown) {
    if (error instanceof Error) {
      parentPort.postMessage({ error: error?.message });
    }
  }
});
