import { exec } from "child_process";
import { getContinueGlobalPath } from "core/util/paths";
import * as path from "path";
import * as vscode from "vscode";
import { ideProtocolClient } from "./activation/activate";

import * as child_process from "child_process";
import { Chunk, DiffLine, IDE, Problem } from "core";
import {
  BrowserSerializedContinueConfig,
  finalToBrowserConfig,
} from "core/config/load";
import { LanceDbIndex } from "core/indexing/LanceDbIndex";
import { IndexTag } from "core/indexing/types";
import { verticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { configHandler } from "./loadConfig";
import { traverseDirectory } from "./util/traverseDirectory";
import { getExtensionUri, openEditorAndRevealRange } from "./util/vscode";

class VsCodeIde implements IDE {
  async getTopLevelCallStackSources(threadIndex: number, stackDepth: number): Promise<string[]> {
    return await ideProtocolClient.getTopLevelCallStackSources(threadIndex, stackDepth);
  }
  async getAvailableThreads(): Promise<string[]> {
    return await ideProtocolClient.getAvailableThreads();
  }
  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    const config = await configHandler.loadConfig();
    return finalToBrowserConfig(config);
  }

  async getDiff(): Promise<string> {
    return await ideProtocolClient.getDiff();
  }

  async getTerminalContents(): Promise<string> {
    return await ideProtocolClient.getTerminalContents(1);
  }

  async getDebugLocals(threadIndex: number): Promise<string> {
    return await ideProtocolClient.getDebugLocals(threadIndex);
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    if (directory) {
      return await ideProtocolClient.getDirectoryContents(directory, true);
    } else {
      const contents = await Promise.all(
        ideProtocolClient
          .getWorkspaceDirectories()
          .map((dir) => ideProtocolClient.getDirectoryContents(dir, true))
      );
      return contents.flat();
    }
  }

  async listFolders(): Promise<string[]> {
    const allDirs: string[] = [];

    const workspaceDirs = await this.getWorkspaceDirs();
    for (const directory of workspaceDirs) {
      for await (const dir of traverseDirectory(
        directory,
        [],
        false,
        undefined
      )) {
        allDirs.push(dir);
      }
    }

    return allDirs;
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return ideProtocolClient.getWorkspaceDirectories();
  }

  async getContinueDir(): Promise<string> {
    return getContinueGlobalPath();
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path),
      Buffer.from(contents)
    );
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    ideProtocolClient.showVirtualFile(title, contents);
  }

  async openFile(path: string): Promise<void> {
    ideProtocolClient.openFile(path);
  }

  async showLines(
    filepath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, 0)
    );
    openEditorAndRevealRange(filepath, range).then(() => {
      ideProtocolClient.highlightCode(
        {
          filepath,
          range,
        },
        "#fff1"
      );
    });
  }

  async runCommand(command: string): Promise<void> {
    await ideProtocolClient.runCommand(command);
  }

  async saveFile(filepath: string): Promise<void> {
    await ideProtocolClient.saveFile(filepath);
  }
  async readFile(filepath: string): Promise<string> {
    return await ideProtocolClient.readFile(filepath);
  }
  async showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void> {
    await ideProtocolClient.showDiff(filepath, newContents, stepIndex);
  }

  async verticalDiffUpdate(
    filepath: string,
    startLine: number,
    endLine: number,
    diffLine: DiffLine
  ) {
    const diffHandler =
      verticalPerLineDiffManager.getOrCreateVerticalPerLineDiffHandler(
        filepath,
        startLine,
        endLine
      );
    if (diffHandler) {
      await diffHandler.handleDiffLine(diffLine);
    }
  }

  async getOpenFiles(): Promise<string[]> {
    return await ideProtocolClient.getOpenFiles();
  }

  async getPinnedFiles(): Promise<string[]> {
    const tabArray = vscode.window.tabGroups.all[0].tabs;

    return tabArray
      .filter((t) => t.isPinned)
      .map((t) => (t.input as vscode.TabInputText).uri.fsPath);
  }

  private async _searchDir(query: string, dir: string): Promise<string> {
    const p = child_process.spawn(
      path.join(
        getExtensionUri().fsPath,
        "node_modules",
        "@vscode",
        "ripgrep",
        "bin",
        "rg"
      ),
      ["-i", "-C", "2", `"${query}"`, "."],
      { cwd: dir }
    );
    let output = "";

    p.stdout.on("data", (data) => {
      output += data.toString();
    });

    return new Promise<string>((resolve, reject) => {
      p.on("error", reject);
      p.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  async getSearchResults(query: string): Promise<string> {
    let results = [];
    for (let dir of await this.getWorkspaceDirs()) {
      results.push(await this._searchDir(query, dir));
    }

    return results.join("\n\n");
  }

  async getProblems(filepath?: string | undefined): Promise<Problem[]> {
    const uri = filepath
      ? vscode.Uri.file(filepath)
      : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return [];
    }
    return vscode.languages.getDiagnostics(uri).map((d) => {
      return {
        filepath: uri.fsPath,
        range: {
          start: {
            line: d.range.start.line,
            character: d.range.start.character,
          },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        message: d.message,
      };
    });
  }

  async subprocess(command: string): Promise<[string, string]> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(stderr);
        }
        resolve([stdout, stderr]);
      });
    });
  }

  async getBranch(dir: string): Promise<string> {
    return ideProtocolClient.getBranch(vscode.Uri.file(dir));
  }

  async getFilesToEmbed(
    providerId: string
  ): Promise<[string, string, string][]> {
    return [];
  }

  async sendEmbeddingForChunk(
    chunk: Chunk,
    embedding: number[],
    tags: string[]
  ) {}

  async retrieveChunks(
    text: string,
    n: number,
    directory: string | undefined
  ): Promise<Chunk[]> {
    const embeddingsProvider = (await configHandler.loadConfig())
      .embeddingsProvider;
    if (!embeddingsProvider) {
      return [];
    }
    const lanceDbIndex = new LanceDbIndex(embeddingsProvider, (path) =>
      ideProtocolClient.readFile(path)
    );

    const tags = await Promise.all(
      (await this.getWorkspaceDirs()).map(async (dir) => {
        let branch = await ideProtocolClient.getBranch(vscode.Uri.file(dir));
        let tag: IndexTag = {
          directory: dir,
          branch,
          artifactId: lanceDbIndex.artifactId,
        };
        return tag;
      })
    );
    let chunks = await lanceDbIndex.retrieve(tags, text, n, directory);
    return chunks as any[];
  }
}

export { VsCodeIde };
