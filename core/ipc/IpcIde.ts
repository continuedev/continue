import { Chunk, ContinueRcJson, IDE, Problem, Range } from "..";
import { IpcMessenger } from "./messenger";

export class IpcIde implements IDE {
  private messenger: IpcMessenger;

  constructor(messenger: IpcMessenger) {
    this.messenger = messenger;
  }
  readRangeInFile(filepath: string, range: Range): Promise<string> {
    throw new Error("Method not implemented.");
  }

  getStats(directory: string): Promise<{ [path: string]: number }> {
    throw new Error("Method not implemented.");
  }

  isTelemetryEnabled(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  getUniqueId(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    throw new Error("Method not implemented.");
  }
  getDiff(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getTerminalContents(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  listWorkspaceContents(directory?: string | undefined): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  listFolders(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  getWorkspaceDirs(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  writeFile(path: string, contents: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  showVirtualFile(title: string, contents: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getContinueDir(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  openFile(path: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  runCommand(command: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  saveFile(filepath: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  readFile(filepath: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  showLines(
    filepath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getOpenFiles(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  getPinnedFiles(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  getSearchResults(query: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  subprocess(command: string): Promise<[string, string]> {
    throw new Error("Method not implemented.");
  }
  getProblems(filepath?: string | undefined): Promise<Problem[]> {
    throw new Error("Method not implemented.");
  }
  getBranch(dir: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getFilesToEmbed(providerId: string): Promise<[string, string, string][]> {
    throw new Error("Method not implemented.");
  }
  sendEmbeddingForChunk(
    chunk: Chunk,
    embedding: number[],
    tags: string[]
  ): void {
    throw new Error("Method not implemented.");
  }
  retrieveChunks(
    text: string,
    n: number,
    directory: string | undefined
  ): Promise<Chunk[]> {
    throw new Error("Method not implemented.");
  }
}
