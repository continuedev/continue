import { ContinueRcJson, IDE, Problem, Range } from "core";
import { WebviewProtocol } from "core/web/webviewProtocol";
import { ideRequest } from "./ide";
function r<T extends keyof WebviewProtocol>(
  messageType: T,
  data: WebviewProtocol[T][0]
): Promise<WebviewProtocol[T][1]> {
  return ideRequest(messageType, data);
}
export class WebviewIde implements IDE {
  readRangeInFile(filepath: string, range: Range): Promise<string> {
    return r("readRangeInFile", { filepath, range });
  }
  getStats(directory: string): Promise<{ [path: string]: number }> {
    throw new Error("Method not implemented.");
  }
  isTelemetryEnabled(): Promise<boolean> {
    return r("isTelemetryEnabled", undefined);
  }

  getUniqueId(): Promise<string> {
    return r("getUniqueId", undefined);
  }

  getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    return r("getWorkspaceConfigs", undefined);
  }

  async getDiff() {
    return await r("getDiff", undefined);
  }

  async getTerminalContents() {
    return await r("getTerminalContents", undefined);
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    return await r("listWorkspaceContents", undefined);
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return await r("getWorkspaceDirs", undefined);
  }

  async showLines(
    filepath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    return await r("showLines", { filepath, startLine, endLine });
  }

  async listFolders(): Promise<string[]> {
    return await r("listFolders", undefined);
  }

  _continueDir: string | null = null;

  async getContinueDir(): Promise<string> {
    if (this._continueDir) {
      return this._continueDir;
    }
    const dir = await r("getContinueDir", undefined);
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

  getOpenFiles(): Promise<string[]> {
    return r("getOpenFiles", undefined);
  }

  getPinnedFiles(): Promise<string[]> {
    return r("getPinnedFiles", undefined);
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

  async getBranch(dir: string): Promise<string> {
    return r("getBranch", { dir });
  }
}
