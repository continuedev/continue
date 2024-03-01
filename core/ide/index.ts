import { Chunk, DiffLine, Problem } from "..";
import { BrowserSerializedContinueConfig } from "../config/load";
import { IDE } from "../index";

import { ideRequest } from "./messaging";
async function r(messageType: string, options: any = {}) {
  return await ideRequest(messageType, options);
}
export class ExtensionIde implements IDE {
  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number
  ): Promise<string[]> {
    return await r("getTopLevelCallStackSources");
  }
  async getAvailableThreads(): Promise<string[]> {
    return await r("getAvailableThreads");
  }
  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    return await r("getSerializedConfig");
  }

  async getDiff() {
    return await r("getDiff");
  }

  async getTerminalContents() {
    return await r("getTerminalContents");
  }

  async getDebugLocals(threadIndex: number) {
    return await r("getTerminalContents");
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    return await r("listWorkspaceContents");
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return await r("getWorkspaceDirs");
  }

  async showLines(
    filepath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    return await r("showLines", { filepath, startLine, endLine });
  }

  async listFolders(): Promise<string[]> {
    return await r("listFolders");
  }

  _continueDir: string | null = null;

  async getContinueDir(): Promise<string> {
    if (this._continueDir) {
      return this._continueDir;
    }
    const dir = await r("getContinueDir");
    this._continueDir = dir;
    return dir;
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await r("writeFile", { path, contents });
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    await r("showVirtualFile", { name: title, content: contents });
  }

  async openFile(path: string): Promise<void> {
    await r("openFile", { path });
  }

  async runCommand(command: string): Promise<void> {
    await r("runCommand", { command });
  }

  async saveFile(filepath: string): Promise<void> {
    await r("saveFile", { filepath });
  }
  async readFile(filepath: string): Promise<string> {
    return await r("readFile", { filepath });
  }
  async showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void> {
    await r("showDiff", { filepath, newContents, stepIndex });
  }

  async verticalDiffUpdate(
    filepath: string,
    startLine: number,
    endLine: number,
    diffLine: DiffLine
  ) {
    await r("diffLine", { filepath, startLine, endLine, diffLine });
  }

  getOpenFiles(): Promise<string[]> {
    return r("getOpenFiles");
  }

  getPinnedFiles(): Promise<string[]> {
    return r("getPinnedFiles");
  }

  getSearchResults(query: string): Promise<string> {
    return r("getSearchResults", { query });
  }

  getProblems(filepath?: string | undefined): Promise<Problem[]> {
    return r("getProblems", { filepath });
  }

  subprocess(command: string): Promise<[string, string]> {
    return r("subprocess", { command });
  }

  getFilesToEmbed(providerId: string): Promise<[string, string, string][]> {
    return r("getFilesToEmbed", { providerId });
  }

  sendEmbeddingForChunk(chunk: Chunk, embedding: number[], tags: string[]) {
    return r("sendChunkForFile", { chunk, embedding, tags });
  }

  async getBranch(dir: string): Promise<string> {
    return r("getBranch", { dir });
  }

  retrieveChunks(
    text: string,
    n: number,
    directory: string | undefined
  ): Promise<Chunk[]> {
    return r("retrieveChunks", { text, n, directory });
  }
}
