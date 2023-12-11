import * as fs from "fs";
import { SerializedContinueConfig } from "../config";
import { getConfigJsonPath, getContinueGlobalPath } from "../util/paths";
import { IDE } from "./types";

class FileSystemIde implements IDE {
  async getSerializedConfig(): Promise<SerializedContinueConfig> {
    const configPath = getConfigJsonPath();
    let contents = fs.readFileSync(configPath, "utf8");
    return JSON.parse(contents) as SerializedContinueConfig;
  }

  getDiff(): Promise<string> {
    return Promise.resolve("");
  }
  getTerminalContents(): Promise<string> {
    return Promise.resolve("");
  }
  listWorkspaceContents(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir("/tmp/continue", (err, files) => {
        if (err) {
          reject(err);
        }
        resolve(files);
      });
    });
  }
  getWorkspaceDir(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.mkdtemp("/tmp/continue", (err, folder) => {
        if (err) {
          reject(err);
        }
        resolve(folder);
      });
    });
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
    stepIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }
}

export default FileSystemIde;
