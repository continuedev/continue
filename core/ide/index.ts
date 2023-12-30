import { DiffLine } from "..";
import { IDE, SerializedContinueConfig } from "../index";
import { ideRequest } from "./messaging";
async function r(messageType: string, options: any = {}) {
  return await ideRequest(messageType, options);
}
export class ExtensionIde implements IDE {
  async getSerializedConfig(): Promise<SerializedContinueConfig> {
    return await r("getSerializedConfig");
  }

  async getConfigJsUrl(): Promise<string | undefined> {
    return await r("getConfigJsUrl");
  }

  async getDiff() {
    return await r("getDiff");
  }

  async getTerminalContents() {
    return await r("getTerminalContents");
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    return await r("listWorkspaceContents");
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return await r("getWorkspaceDirs");
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
}
