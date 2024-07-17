import { Chunk, IDE } from "@continuedev/core";
import { ConfigHandler } from "@continuedev/core/dist/config/ConfigHandler.js";
import {
  IRetrievalPipeline,
  RetrievalPipelineRunArguments,
} from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
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

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPOS_DIR = path.join(__dirname, "..", "repos");

function dirForRepo(repo: string): string {
  // Extract the last part of the URL (repository name)
  const repoName = repo.split("/").pop() || "";

  // Remove 'https://' or 'http://' if present
  const cleanRepo = repoName.replace(/^(https?:\/\/)?/, "");

  // Replace special characters with dashes and convert to lowercase
  const escapedRepo = cleanRepo.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return path.join(REPOS_DIR, escapedRepo);
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
    // @ts-ignore
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
          resolve();
        }
      });
    });
  }
}

export async function retrieveInRepo(
  repo: string,
  query: string,
  pipeline: IRetrievalPipeline,
): Promise<Chunk[]> {
  // Make sure repo is downloaded
  await downloadOrUpdateRepo(repo);

  const workspaceDir = dirForRepo(repo);

  // Fixtures
  const ide = new FileSystemIde(workspaceDir);

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
  const args: RetrievalPipelineRunArguments = {
    query,
    tags: [
      {
        branch: "main", // This matches the value for FileSystemIde
        directory: workspaceDir,
      },
    ],
  };
  const results = await pipeline.run(args);
  return results;
}
