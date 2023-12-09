import { SerializedContinueConfig } from "../config";

interface IDE {
  getSerializedConfig(): Promise<SerializedContinueConfig>;
  getDiff(): Promise<string>;
  getTerminalContents(): Promise<string>;
  listWorkspaceContents(): Promise<string[]>;
  getWorkspaceDir(): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  showVirtualFile(title: string, contents: string): Promise<void>;
  getContinueDir(): Promise<string>;
  openFile(path: string): Promise<void>;
  runCommand(command: string): Promise<void>;
}

export { IDE };
