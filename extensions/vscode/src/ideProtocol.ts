import { IDE } from "core/ide/types";
import * as fs from "fs";
import { getConfigJsonPath } from "./activation/environmentSetup";
import { ideProtocolClient } from "./activation/activate";
import { SerializedContinueConfig } from "core/config/index";

class VsCodeIde implements IDE {
  async getSerializedConfig(): Promise<SerializedContinueConfig> {
    const configPath = getConfigJsonPath();
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config;
  }

  async getDiff(): Promise<string> {
    return await ideProtocolClient.getDiff();
  }

  async getTerminalContents(): Promise<string> {
    return await ideProtocolClient.getTerminalContents(2);
  }

  async listWorkspaceContents(): Promise<string[]> {
    return await ideProtocolClient.getDirectoryContents(
      ideProtocolClient.getWorkspaceDirectory(),
      true
    );
  }

  async getWorkspaceDir(): Promise<string> {
    return ideProtocolClient.getWorkspaceDirectory();
  }
}

export default VsCodeIde;
