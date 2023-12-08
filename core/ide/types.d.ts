import { SerializedContinueConfig } from "../types";

interface IDE {
  getSerializedConfig(): Promise<SerializedContinueConfig>;
  getDiff(): Promise<string>;
  getTerminalContents(): Promise<string>;
  listWorkspaceContents(): Promise<string[]>;
  getWorkspaceDir(): Promise<string>;
}

export { IDE };
