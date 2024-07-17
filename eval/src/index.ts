import { ConfigHandler } from "@continuedev/core/dist/config/ConfigHandler.js";
import { IRetrievalPipeline } from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/dist/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import { ControlPlaneClient } from "@continuedev/core/dist/control-plane/client.js";
import FileSystemIde from "@continuedev/core/dist/util/filesystem.js";
import chalk from "chalk";
import dotenv from "dotenv";
import path from "path";
import { accuracy } from "./metrics.js";
import { testSet } from "./testSet.js";
import { TestSetItem } from "./TestSetItem.js";
import { dirForRepo, retrieveInRepo } from "./util.js";

dotenv.config();

async function testStrategy(
  pipeline: IRetrievalPipeline,
  tests: TestSetItem[],
) {
  for (const test of tests) {
    const results = await retrieveInRepo(test.repo, test.query, pipeline);

    console.log(chalk.cyan(`\nResults for ${test.repo}:`));
    console.log(chalk.yellow(`Query: ${test.query}`));
    console.log(chalk.green("Retrieved files:"));
    for (const result of results) {
      console.log(chalk.white(`- ${result.filepath}`));
    }

    const acc = accuracy(
      results,
      test.groundTruthFiles.map((file) =>
        path.join(dirForRepo(test.repo), file),
      ),
    );
    console.log(chalk.green(`Accuracy: ${acc}`));
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
