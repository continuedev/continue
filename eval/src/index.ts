import { ConfigHandler } from "@continuedev/core/dist/config/ConfigHandler.js";
import { IRetrievalPipeline } from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/dist/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import { ControlPlaneClient } from "@continuedev/core/dist/control-plane/client.js";
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
  const ide = new FileSystemIde("");
  const configHandler = new ConfigHandler(
    ide,
    Promise.resolve({
      remoteConfigSyncPeriod: 60,
      userToken: "",
      enableControlServerBeta: false,
    }),
    async () => {},
    new ControlPlaneClient(
      Promise.resolve({
        accessToken: "",
        account: {
          id: "",
          label: "",
        },
      }),
    ),
  );
  const config = await configHandler.loadConfig();

  const pipeline = new RerankerRetrievalPipeline({
    embeddingsProvider: config.embeddingsProvider,
    reranker: config.reranker,
    nRetrieve: 50,
    nFinal: 20,
    ide,
  });
  const tests = testSet;
  await testStrategy(pipeline, tests);
}

main();
