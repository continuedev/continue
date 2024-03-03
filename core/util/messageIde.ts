import { ContinueRcJson, IDE, IdeInfo, Problem, Range } from "..";

export class MessageIde implements IDE {
  constructor(
    private readonly request: (messageType: string, data: any) => Promise<any>,
  ) {}
  getIdeInfo(): Promise<IdeInfo> {
    return this.request("getIdeInfo", undefined);
  }

  readRangeInFile(filepath: string, range: Range): Promise<string> {
    return this.request("readRangeInFile", { filepath, range });
  }
  getStats(directory: string): Promise<{ [path: string]: number }> {
    throw new Error("Method not implemented.");
  }
  isTelemetryEnabled(): Promise<boolean> {
    return this.request("isTelemetryEnabled", undefined);
  }

  getUniqueId(): Promise<string> {
    return this.request("getUniqueId", undefined);
  }

  getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    return this.request("getWorkspaceConfigs", undefined);
  }

  async getDiff() {
    return await this.request("getDiff", undefined);
  }

  async getTerminalContents() {
    return await this.request("getTerminalContents", undefined);
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    return await this.request("listWorkspaceContents", undefined);
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return await this.request("getWorkspaceDirs", undefined);
  }

  async showLines(
    filepath: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    return await this.request("showLines", { filepath, startLine, endLine });
  }

  async listFolders(): Promise<string[]> {
    return await this.request("listFolders", undefined);
  }

  _continueDir: string | null = null;

  async getContinueDir(): Promise<string> {
    if (this._continueDir) {
      return this._continueDir;
    }
    const dir = await this.request("getContinueDir", undefined);
    this._continueDir = dir;
    return dir;
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await this.request("writeFile", { path, contents });
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    await this.request("showVirtualFile", { name: title, content: contents });
  }

  async openFile(path: string): Promise<void> {
    await this.request("openFile", { path });
  }

  async runCommand(command: string): Promise<void> {
    await this.request("runCommand", { command });
  }

  async saveFile(filepath: string): Promise<void> {
    await this.request("saveFile", { filepath });
  }
  async readFile(filepath: string): Promise<string> {
    return await this.request("readFile", { filepath });
  }
  async showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number,
  ): Promise<void> {
    await this.request("showDiff", { filepath, newContents, stepIndex });
  }

  getOpenFiles(): Promise<string[]> {
    return this.request("getOpenFiles", undefined);
  }

  getPinnedFiles(): Promise<string[]> {
    return this.request("getPinnedFiles", undefined);
  }

  getSearchResults(query: string): Promise<string> {
    return this.request("getSearchResults", { query });
  }

  getProblems(filepath?: string | undefined): Promise<Problem[]> {
    return this.request("getProblems", { filepath });
  }

  subprocess(command: string): Promise<[string, string]> {
    return this.request("subprocess", { command });
  }

  async getBranch(dir: string): Promise<string> {
    return this.request("getBranch", { dir });
  }
}
