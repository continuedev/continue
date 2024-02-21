import * as fs from "fs";
import { DiffLine, IDE, Problem } from "..";
import { BrowserSerializedContinueConfig } from "../config/load";
import { Chunk } from "../index";
import { getContinueGlobalPath } from "../util/paths";

class FileSystemIde implements IDE {
  async getDebugLocals(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    throw new Error("Not implemented");
  }

  getDiff(): Promise<string> {
    return Promise.resolve("");
  }
  getTerminalContents(): Promise<string> {
    return Promise.resolve("");
  }
  showLines(
    filepath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    return Promise.resolve();
  }
  listWorkspaceContents(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir("/tmp/continue", (err, files) => {
        if (err) {
          reject(err);
        }
        resolve(files);
      });
    });
  }
  getWorkspaceDirs(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.mkdtemp("/tmp/continue", (err, folder) => {
        if (err) {
          reject(err);
        }
        resolve([folder]);
      });
    });
  }
  listFolders(): Promise<string[]> {
    return Promise.resolve([]);
  }
  writeFile(path: string, contents: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(path, contents, (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }
  showVirtualFile(title: string, contents: string): Promise<void> {
    return Promise.resolve();
  }
  getContinueDir(): Promise<string> {
    return Promise.resolve(getContinueGlobalPath());
  }
  openFile(path: string): Promise<void> {
    return Promise.resolve();
  }
  runCommand(command: string): Promise<void> {
    return Promise.resolve();
  }
  saveFile(filepath: string): Promise<void> {
    return Promise.resolve();
  }
  readFile(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, "utf8", (err, contents) => {
        if (err) {
          reject(err);
        }
        resolve(contents);
      });
    });
  }
  showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }

  getBranch(dir: string): Promise<string> {
    return Promise.resolve("");
  }

  async verticalDiffUpdate(
    filepath: string,
    startLine: number,
    endLine: number,
    diffLine: DiffLine
  ) {
    return Promise.resolve();
  }

  getOpenFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  getPinnedFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  async getSearchResults(query: string): Promise<string> {
    return "";
  }

  async getProblems(filepath?: string | undefined): Promise<Problem[]> {
    return Promise.resolve([]);
  }

  async subprocess(command: string): Promise<[string, string]> {
    return ["", ""];
  }

  getFilesToEmbed(providerId: string): Promise<[string, string, string][]> {
    return Promise.resolve([]);
  }

  sendEmbeddingForChunk(chunk: Chunk, embedding: number[], tags: string[]) {}

  retrieveChunks(
    text: string,
    n: number,
    directory: string | undefined
  ): Promise<Chunk[]> {
    return Promise.resolve([]);
  }
}

export default FileSystemIde;
