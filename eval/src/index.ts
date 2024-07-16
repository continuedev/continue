import { Chunk, EmbeddingsProvider, IDE, Reranker } from "@continuedev/core";
import { ConfigHandler } from "@continuedev/core/config/ConfigHandler.js";
import { IRetrievalPipeline } from "@continuedev/core/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import { ContinueServerClient } from "@continuedev/core/continueServer/stubs/client.js";
import { ControlPlaneClient } from "@continuedev/core/control-plane/client.js";
import {
  CodebaseIndexer,
  PauseToken,
} from "@continuedev/core/indexing/CodebaseIndexer.js";
import FileSystemIde from "@continuedev/core/util/filesystem.js";

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

async function downloadOrUpdateRepo(repo: string): Promise<void> {}

async function retrieveInRepo(
  repo: string,
  query: string,
  strategy: RetrievalStrategy,
): Promise<Chunk[]> {
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

const r = new RerankerRetrievalPipeline();
