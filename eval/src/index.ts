import { VoyageReranker } from "@continuedev/core/dist/context/rerankers/voyage.js";
import { IRetrievalPipeline } from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/dist/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import OpenAIEmbeddingsProvider from "@continuedev/core/dist/indexing/embeddings/OpenAIEmbeddingsProvider.js";
import FileSystemIde from "@continuedev/core/dist/util/filesystem.js";
import dotenv from "dotenv";
import { accuracy } from "./metrics.js";
import { testSet } from "./testSet.js";
import { TestSetItem } from "./TestSetItem.js";
import { retrieveInRepo } from "./util.js";

dotenv.config();

async function testStrategy(
  pipeline: IRetrievalPipeline,
  tests: TestSetItem[],
) {
  for (const test of tests) {
    const results = await retrieveInRepo(test.repo, test.query, pipeline);
    const acc = accuracy(results, test.groundTruthFiles);
    console.log(`Repo: ${test.repo}\nQuery: ${test.query}\nAccuracy: ${acc}`);
  }
}

async function main() {
  const reranker = new VoyageReranker({
    apiKey: process.env.VOYAGE_API_KEY || "",
    model: "rerank-lite-1",
  });
  const embeddingsProvider = new OpenAIEmbeddingsProvider(
    {
      apiBase: "https://api.voyageai.com/v1",
      apiKey: process.env.VOYAGE_API_KEY || "",
      model: "voyage-code-2",
    },
    fetch,
  );
  const pipeline = new RerankerRetrievalPipeline({
    embeddingsProvider,
    reranker,
    nRetrieve: 50,
    nFinal: 20,
    ide: new FileSystemIde(""),
  });
  const tests = testSet;
  await testStrategy(pipeline, tests);
}

main();
