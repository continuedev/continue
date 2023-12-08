import { ideRequest } from "./messaging";
import { IDE } from "./types";

export class ExtensionIde implements IDE {
  async getSerializedConfig() {
    const resp = await ideRequest("getSerializedConfig", {});
    return resp.config;
  }

  async getDiff() {
    const resp = await ideRequest("getDiff", {});
    return resp.diff;
  }

  async getTerminalContents() {
    const resp = await ideRequest("getTerminalContents", {});
    return resp.terminalContents;
  }

  async listWorkspaceContents(): Promise<string[]> {
    const resp = await ideRequest("listWorkspaceContents", {});
    return resp.workspaceContents;
  }

  async getWorkspaceDir(): Promise<string> {
    const resp = await ideRequest("getWorkspaceDir", {});
    return resp.workspaceDir;
  }
}
