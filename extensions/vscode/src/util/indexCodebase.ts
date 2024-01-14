import { LanceDbIndex } from "core/index/LanceDbIndex";
import { CodebaseIndex, IndexTag, LastModifiedMap } from "core/index/index";
import { getComputeDeleteAddRemove } from "core/index/refreshIndex";
import * as vscode from "vscode";
import { ideProtocolClient } from "../activation/activate";
import { debugPanelWebview } from "../debugPanel";
import { VsCodeIde } from "../ideProtocol";
import { configHandler } from "../loadConfig";

const vscodeGetStats = async (
  directory: string | undefined
): Promise<LastModifiedMap> => {
  const files = await new VsCodeIde().listWorkspaceContents(directory);
  const pathToLastModified: { [path: string]: number } = {};
  await Promise.all(
    files.map(async (file) => {
      let stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
      pathToLastModified[file] = stat.mtime;
    })
  );

  return pathToLastModified;
};

async function getIndexesToBuild(): Promise<CodebaseIndex[]> {
  const indexes = [];

  const config = await configHandler.loadConfig(new VsCodeIde());
  if (config.embeddingsProvider) {
    indexes.push(new LanceDbIndex(config.embeddingsProvider));
  }

  return indexes;
}

export async function vsCodeIndexCodebase() {
  const update = (progress: number) => {
    debugPanelWebview?.postMessage({ type: "indexProgress", progress });
  };

  const workspaceDirs = ideProtocolClient.getWorkspaceDirectories();
  const indexesToBuild = await getIndexesToBuild();
  const branch = await ideProtocolClient.getBranch();

  let completedDirs = 0;

  for (let directory of workspaceDirs) {
    const stats = await vscodeGetStats(directory);
    let completedIndexes = 0;

    for (let codebaseIndex of indexesToBuild) {
      const tag: IndexTag = {
        directory,
        branch,
        artifactId: codebaseIndex.artifactId,
      };
      const results = await getComputeDeleteAddRemove(
        tag,
        stats,
        ideProtocolClient.readFile
      );

      for await (let progress of codebaseIndex.update(tag, results)) {
        update(
          (completedDirs +
            (completedIndexes + progress) / indexesToBuild.length) /
            workspaceDirs.length
        );
      }
      completedIndexes++;
      update(
        (completedDirs + completedIndexes / indexesToBuild.length) /
          workspaceDirs.length
      );
    }

    completedDirs++;
    update(completedDirs / workspaceDirs.length);
  }
}
