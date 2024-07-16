import { Chunk, EmbeddingsProvider, IDE, Reranker } from "@continuedev/core";
import { ConfigHandler } from "@continuedev/core/dist/config/ConfigHandler.js";
import { IRetrievalPipeline } from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import { ContinueServerClient } from "@continuedev/core/dist/continueServer/stubs/client.js";
import { ControlPlaneClient } from "@continuedev/core/dist/control-plane/client.js";
import {
  CodebaseIndexer,
  PauseToken,
} from "@continuedev/core/dist/indexing/CodebaseIndexer.js";
import FileSystemIde from "@continuedev/core/dist/util/filesystem.js";

import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

process.env.CONTINUE_GLOBAL_DIR = "./.continue.test";
const REPOS_DIR = "./.repos";

function dirForRepo(repo: string): string {
  // Extract the last part of the URL (repository name)
  const repoName = repo.split("/").pop() || "";

  // Remove 'https://' or 'http://' if present
  const cleanRepo = repoName.replace(/^(https?:\/\/)?/, "");

  // Replace special characters with dashes and convert to lowercase
  const escapedRepo = cleanRepo.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return `${REPOS_DIR}/${escapedRepo}`;
}

interface RetrievalStrategy {
  pipeline: IRetrievalPipeline;
  embeddingsProvider: EmbeddingsProvider;
  reranker: Reranker;
  nRetrieve: number;
  nFinal: number;
}

function createCodebaseIndexer(ide: IDE): CodebaseIndexer {
  const continueServerClient = new ContinueServerClient(undefined, undefined);
  const configHandler = new ConfigHandler(
    ide,
    Promise.resolve({
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 60,
      userToken: "",
      enableControlServerBeta: false,
    }),
    async () => {},
    new ControlPlaneClient(Promise.resolve(undefined)),
  );
  const pauseToken = new PauseToken(false);
  return new CodebaseIndexer(
    configHandler,
    ide,
    pauseToken,
    continueServerClient,
  );
}

const onsole = {
  log: (...args: any[]) => {},
};

async function downloadOrUpdateRepo(repo: string): Promise<void> {
  const repoDir = dirForRepo(repo);

  try {
    // Check if the directory already exists
    await fs.access(repoDir);

    // If it exists, perform a git pull
    await new Promise<void>((resolve, reject) => {
      exec("git pull", { cwd: repoDir }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error updating repo: ${error.message}`);
          reject(error);
        } else {
          console.log(`Updated repo: ${stdout}`);
          resolve();
        }
      });
    });
  } catch (error) {
    // If the directory doesn't exist, clone the repo
    await fs.mkdir(path.dirname(repoDir), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      exec(`git clone ${repo} ${repoDir}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error cloning repo: ${error.message}`);
          reject(error);
        } else {
          console.log(`Cloned repo: ${stdout}`);
          resolve();
        }
      });
    });
  }
}

async function retrieveInRepo(
  repo: string,
  query: string,
  strategy: RetrievalStrategy,
): Promise<Chunk[]> {
  // Make sure repo is downloaded
  await downloadOrUpdateRepo(repo);

  const workspaceDir = dirForRepo(repo);

  // Fixtures
  const ide = new FileSystemIde(workspaceDir);
  const { pipeline, embeddingsProvider, reranker, nFinal, nRetrieve } =
    strategy;

  // Make sure codebase indexes are updated
  const codebaseIndexer = createCodebaseIndexer(ide);
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  for await (const update of codebaseIndexer.refresh(
    await ide.getWorkspaceDirs(),
    abortSignal,
  )) {
    onsole.log("update", update);
  }
  onsole.log("done updating indexes");

  // Run pipeline
  const results = await pipeline.run({
    input: query,
    ide,
    embeddingsProvider,
    reranker,
    nRetrieve,
    nFinal,
    tags: [
      {
        branch: "main",
        directory: workspaceDir,
      },
    ],
  });
  return results;
}

function accuracy(results: Chunk[], expected: string[]): number {
  let score = 0;
  for (const result of results) {
    if (expected.includes(result.filepath)) {
      score += 1;
    }
  }
  return score / expected.length;
}
