import { ConfigHandler } from "@continuedev/core/dist/config/ConfigHandler.js";
import {
  IRetrievalPipeline,
  RetrievalPipelineOptions,
} from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import FtsRetrievalPipeline from "./pipelines/FilepathOnlyFtsRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/dist/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import { ControlPlaneClient } from "@continuedev/core/dist/control-plane/client.js";
import FileSystemIde from "@continuedev/core/dist/util/filesystem.js";
import chalk from "chalk";
import dotenv from "dotenv";
import path from "path";
import { accuracy } from "./metrics.js";
import { rerankerTestSet, filepathTestSet } from "./testSet.js";
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
    console.log(chalk.yellow(`Query: "${test.query}"`));
    console.log(chalk.green("Retrieved files:"));
    for (const result of results) {
      console.log(chalk.white(`    - ${result.filepath}`));
    }

    const expectedFiles = test.groundTruthFiles.map((file) =>
      path.join(dirForRepo(test.repo), file),
    );

    console.log("\n");

    console.log(chalk.green("Expected files: "));
    for (const expectedFile of expectedFiles) {
      console.log(chalk.white(`    - ${expectedFile}`));
    }

    console.log("\n");

    const acc = accuracy(results, expectedFiles);
    console.log(chalk.green(`Accuracy: ${acc}`));
  }
}

async function runRerankerTest(opts: RetrievalPipelineOptions) {
  const pipeline = new RerankerRetrievalPipeline(opts);
  await testStrategy(pipeline, rerankerTestSet);
}

async function runFilepathTest(opts: RetrievalPipelineOptions) {
  const pipeline = new FtsRetrievalPipeline(opts);
  await testStrategy(pipeline, filepathTestSet);
}

async function main() {
  console.log(chalk.green("Running retrieval tests..."));

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

  const opts = {
    ide,
    embeddingsProvider: config.embeddingsProvider,
    reranker: config.reranker,
    nRetrieve: 50,
    nFinal: 20,
  };

  // await runRerankerTest(opts);
  await runFilepathTest(opts);
}

main();
