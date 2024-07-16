import { Chunk, EmbeddingsProvider, Reranker } from "@continuedev/core";
import { ConfigHandler } from "@continuedev/core/config/ConfigHandler";
import { IRetrievalPipeline } from "@continuedev/core/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import RerankerRetrievalPipeline from "@continuedev/core/context/retrieval/pipelines/RerankerRetrievalPipeline.js";
import { CodebaseIndexer } from "@continuedev/core/indexing/CodebaseIndexer.js";
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

async function retrieveInRepo(
  repo: string,
  query: string,
  strategy: RetrievalStrategy,
): Promise<Chunk> {
  const repoDir = dirForRepo(repo);

  // Fixtures
  const ide = new FileSystemIde(repoDir);
  const configHandler = new ConfigHandler(repoDir);
  const continueServerClient = new ContinueServerClient(undefined, undefined);

  const { pipeline, embeddingsProvider, reranker, nFinal, nRetrieve } =
    strategy;

  // Make sure codebase indexes are updated
  const codebaseIndexer = new CodebaseIndexer(
    configHandler,
    ide,
    pauseToken,
    continueServerClient,
  );

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
        directory: repoDir,
      },
    ],
  });
  return results;
}

const r = new RerankerRetrievalPipeline();
