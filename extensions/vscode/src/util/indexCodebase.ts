import { LanceDbIndex } from "core/indexing/LanceDbIndex";
import { getComputeDeleteAddRemove } from "core/indexing/refreshIndex";
import { CodebaseIndex, IndexTag, LastModifiedMap } from "core/indexing/types";
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

  const ide = new VsCodeIde();
  const config = await configHandler.loadConfig(ide);
  indexes.push(new LanceDbIndex(config.embeddingsProvider, ide.readFile));

  return indexes;
}

export async function vsCodeIndexCodebase(workspaceDirs: string[]) {
  const update = (progress: number) => {
    debugPanelWebview?.postMessage({ type: "indexProgress", progress });
  };

  const indexesToBuild = await getIndexesToBuild();

  let completedDirs = 0;

  for (let directory of workspaceDirs) {
    const stats = await vscodeGetStats(directory);
    const branch = await ideProtocolClient.getBranch(
      vscode.Uri.file(directory)
    );
    let completedIndexes = 0;

    try {
      for (let codebaseIndex of indexesToBuild) {
        const tag: IndexTag = {
          directory,
          branch,
          artifactId: codebaseIndex.artifactId,
        };
        const [results, markComplete] = await getComputeDeleteAddRemove(
          tag,
          stats,
          (filepath) => ideProtocolClient.readFile(filepath)
        );

        // console.log("RESULTS: ", results);

        for await (let progress of codebaseIndex.update(
          tag,
          results,
          markComplete
        )) {
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
    } catch (e) {
      console.warn("Error refreshing index: ", e);
    }

    completedDirs++;
    update(completedDirs / workspaceDirs.length);
  }
}
