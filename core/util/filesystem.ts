import * as fs from "node:fs";
import {
  ContinueRcJson,
  FileType,
  IDE,
  IdeInfo,
  IdeSettings,
  IndexTag,
  Location,
  Problem,
  Range,
  RangeInFile,
  Thread,
} from "../index.d.js";

import { getContinueGlobalPath } from "./paths.js";

class FileSystemIde implements IDE {
  static workspaceDir = "/tmp/continue";

  constructor() {
    fs.mkdirSync(FileSystemIde.workspaceDir, { recursive: true });
  }

  gotoDefinition(location: Location): Promise<RangeInFile[]> {
    throw new Error("Method not implemented.");
  }
  onDidChangeActiveTextEditor(callback: (filepath: string) => void): void {
    throw new Error("Method not implemented.");
  }

  async getIdeSettings(): Promise<IdeSettings> {
    return {
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 60,
      userToken: "",
    };
  }
  async getGitHubAuthToken(): Promise<string | undefined> {
    return undefined;
  }
  getLastModified(files: string[]): Promise<{ [path: string]: number }> {
    return new Promise((resolve) => {
      resolve({
        [files[0]]: 1234567890,
      });
    });
  }
  getGitRootPath(dir: string): Promise<string | undefined> {
    return Promise.resolve(dir);
  }
  async listDir(dir: string): Promise<[string, FileType][]> {
    const all: [string, FileType][] = fs
      .readdirSync(dir, { withFileTypes: true })
      .map((dirent: any) => [
        dirent.path,
        dirent.isDirectory()
          ? FileType.Directory
          : dirent.isSymbolicLink()
            ? FileType.SymbolicLink
            : FileType.File,
      ]);
    return Promise.resolve(all);
  }
  infoPopup(message: string): Promise<void> {
    return Promise.resolve();
  }
  errorPopup(message: string): Promise<void> {
    return Promise.resolve();
  }
  getRepoName(dir: string): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  getTags(artifactId: string): Promise<IndexTag[]> {
    return Promise.resolve([]);
  }

  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "vscode",
      name: "na",
      version: "0.1",
      remoteName: "na",
      extensionVersion: "na",
    });
  }

  readRangeInFile(filepath: string, range: Range): Promise<string> {
    return Promise.resolve("");
  }

  isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getUniqueId(): Promise<string> {
    return Promise.resolve("NOT_UNIQUE");
  }

  getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    return Promise.resolve([]);
  }

  getDiff(): Promise<string> {
    return Promise.resolve("");
  }

  getTerminalContents(): Promise<string> {
    return Promise.resolve("");
  }

  async getDebugLocals(threadIndex: number): Promise<string> {
    return Promise.resolve("");
  }

  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  async getAvailableThreads(): Promise<Thread[]> {
    return Promise.resolve([]);
  }

  showLines(
    filepath: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    return Promise.resolve();
  }

  listWorkspaceContents(
    directory?: string,
    useGitIgnore?: boolean,
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(FileSystemIde.workspaceDir, (err, files) => {
        if (err) {
          reject(err);
        }
        resolve(files);
      });
    });
  }

  getWorkspaceDirs(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.mkdtemp(FileSystemIde.workspaceDir, (err, folder) => {
        if (err) {
          reject(err);
        }
        resolve([folder]);
      });
    });
  }

  listFolders(): Promise<string[]> {
    return Promise.resolve([]);
  }

  writeFile(path: string, contents: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(path, contents, (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  showVirtualFile(title: string, contents: string): Promise<void> {
    return Promise.resolve();
  }

  getContinueDir(): Promise<string> {
    return Promise.resolve(getContinueGlobalPath());
  }

  openFile(path: string): Promise<void> {
    return Promise.resolve();
  }

  runCommand(command: string): Promise<void> {
    return Promise.resolve();
  }

  saveFile(filepath: string): Promise<void> {
    return Promise.resolve();
  }

  readFile(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, "utf8", (err, contents) => {
        if (err) {
          reject(err);
        }
        resolve(contents);
      });
    });
  }

  showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number,
  ): Promise<void> {
    return Promise.resolve();
  }

  getBranch(dir: string): Promise<string> {
    return Promise.resolve("");
  }

  getOpenFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  getCurrentFile(): Promise<string | undefined> {
    return Promise.resolve("");
  }

  getPinnedFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  async getSearchResults(query: string): Promise<string> {
    return "";
  }

  async getProblems(filepath?: string | undefined): Promise<Problem[]> {
    return Promise.resolve([]);
  }

  async subprocess(command: string): Promise<[string, string]> {
    return ["", ""];
  }
}

export default FileSystemIde;
