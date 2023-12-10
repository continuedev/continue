import { ideRequest } from "./messaging";
import { IDE } from "./types";
async function r(messageType: string, options: any = {}) {
  return await ideRequest(messageType, options);
}
export class ExtensionIde implements IDE {
  async getSerializedConfig() {
    return await r("getSerializedConfig");
  }

  async getDiff() {
    return await r("getDiff");
  }

  async getTerminalContents() {
    return await r("getTerminalContents");
  }

  async listWorkspaceContents(): Promise<string[]> {
    return await r("listWorkspaceContents");
  }

  async getWorkspaceDir(): Promise<string> {
    return await r("getWorkspaceDir");
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
}
