import { exec } from "child_process";
import { getContinueGlobalPath } from "core/util/paths";
import * as path from "path";
import * as vscode from "vscode";

import * as child_process from "child_process";
import { ContinueRcJson, IDE, IdeInfo, Problem, Range } from "core";
import { DiffManager } from "./diff/horizontal";
import { VsCodeIdeUtils } from "./util/ideUtils";
import { traverseDirectory } from "./util/traverseDirectory";
import {
  getExtensionUri,
  openEditorAndRevealRange,
  uriFromFilePath,
} from "./util/vscode";

class VsCodeIde implements IDE {
  ideUtils: VsCodeIdeUtils;

  constructor(private readonly diffManager: DiffManager) {
    this.ideUtils = new VsCodeIdeUtils();
  }
  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "vscode",
      name: vscode.env.appName,
      version: vscode.version,
      remoteName: vscode.env.remoteName || "local",
    });
  }
  readRangeInFile(filepath: string, range: Range): Promise<string> {
    return this.ideUtils.readRangeInFile(
      filepath,
      new vscode.Range(
        new vscode.Position(range.start.line, range.start.character),
        new vscode.Position(range.end.line, range.end.character),
      ),
    );
  }

  async getStats(directory: string): Promise<{ [path: string]: number }> {
    const scheme = vscode.workspace.workspaceFolders?.[0].uri.scheme;
    const files = await this.listWorkspaceContents(directory);
    const pathToLastModified: { [path: string]: number } = {};
    await Promise.all(
      files.map(async (file) => {
        let stat = await vscode.workspace.fs.stat(uriFromFilePath(file));
        pathToLastModified[file] = stat.mtime;
      }),
    );

    return pathToLastModified;
  }

  async getRepo(dir: vscode.Uri): Promise<any> {
    return this.ideUtils.getRepo(dir);
  }

  async isTelemetryEnabled(): Promise<boolean> {
    return (
      (await vscode.workspace
        .getConfiguration("continue")
        .get("telemetryEnabled")) ?? true
    );
  }
  getUniqueId(): Promise<string> {
    return Promise.resolve(vscode.env.machineId);
  }

  async getDiff(): Promise<string> {
    return await this.ideUtils.getDiff();
  }

  async getTerminalContents(): Promise<string> {
    return await this.ideUtils.getTerminalContents(1);
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    if (directory) {
      return await this.ideUtils.getDirectoryContents(directory, true);
    } else {
      const contents = await Promise.all(
        this.ideUtils
          .getWorkspaceDirectories()
          .map((dir) => this.ideUtils.getDirectoryContents(dir, true)),
      );
      return contents.flat();
    }
  }

  async getWorkspaceConfigs() {
    const workspaceDirs =
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri) || [];
    const configs: ContinueRcJson[] = [];
    for (const workspaceDir of workspaceDirs) {
      const files = await vscode.workspace.fs.readDirectory(workspaceDir);
      for (const [filename, type] of files) {
        if (type === vscode.FileType.File && filename === ".continuerc.json") {
          const contents = await this.ideUtils.readFile(
            vscode.Uri.joinPath(workspaceDir, filename).fsPath,
          );
          configs.push(JSON.parse(contents));
        }
      }
    }
    return configs;
  }

  async listFolders(): Promise<string[]> {
    const allDirs: string[] = [];

    const workspaceDirs = await this.getWorkspaceDirs();
    for (const directory of workspaceDirs) {
      for await (const dir of traverseDirectory(
        directory,
        [],
        false,
        undefined,
      )) {
        allDirs.push(dir);
      }
    }

    return allDirs;
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return this.ideUtils.getWorkspaceDirectories();
  }

  async getContinueDir(): Promise<string> {
    return getContinueGlobalPath();
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path),
      Buffer.from(contents),
    );
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    this.ideUtils.showVirtualFile(title, contents);
  }

  async openFile(path: string): Promise<void> {
    this.ideUtils.openFile(path);
  }

  async showLines(
    filepath: string,
    startLine: number,
    endLine: number,
  ): Promise<void> {
    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, 0),
    );
    openEditorAndRevealRange(filepath, range).then(() => {
      // TODO: Highlight lines
      // this.ideUtils.highlightCode(
      //   {
      //     filepath,
      //     range,
      //   },
      //   "#fff1"
      // );
    });
  }

  async runCommand(command: string): Promise<void> {
    if (vscode.window.terminals.length) {
      vscode.window.terminals[0].show();
      vscode.window.terminals[0].sendText(command, false);
    } else {
      const terminal = vscode.window.createTerminal();
      terminal.show();
      terminal.sendText(command, false);
    }
  }

  async saveFile(filepath: string): Promise<void> {
    await this.ideUtils.saveFile(filepath);
  }
  async readFile(filepath: string): Promise<string> {
    return await this.ideUtils.readFile(filepath);
  }
  async showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number,
  ): Promise<void> {
    await this.diffManager.writeDiff(filepath, newContents, stepIndex);
  }

  async getOpenFiles(): Promise<string[]> {
    return await this.ideUtils.getOpenFiles();
  }

  async getPinnedFiles(): Promise<string[]> {
    const tabArray = vscode.window.tabGroups.all[0].tabs;

    return tabArray
      .filter((t) => t.isPinned)
      .map((t) => (t.input as vscode.TabInputText).uri.fsPath);
  }

  private async _searchDir(query: string, dir: string): Promise<string> {
    const p = child_process.spawn(
      path.join(
        getExtensionUri().fsPath,
        "node_modules",
        "@vscode",
        "ripgrep",
        "bin",
        "rg",
      ),
      ["-i", "-C", "2", `"${query}"`, "."],
      { cwd: dir },
    );
    let output = "";

    p.stdout.on("data", (data) => {
      output += data.toString();
    });

    return new Promise<string>((resolve, reject) => {
      p.on("error", reject);
      p.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  async getSearchResults(query: string): Promise<string> {
    let results = [];
    for (let dir of await this.getWorkspaceDirs()) {
      results.push(await this._searchDir(query, dir));
    }

    return results.join("\n\n");
  }

  async getProblems(filepath?: string | undefined): Promise<Problem[]> {
    const uri = filepath
      ? vscode.Uri.file(filepath)
      : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return [];
    }
    return vscode.languages.getDiagnostics(uri).map((d) => {
      return {
        filepath: uri.fsPath,
        range: {
          start: {
            line: d.range.start.line,
            character: d.range.start.character,
          },
          end: { line: d.range.end.line, character: d.range.end.character },
        },
        message: d.message,
      };
    });
  }

  async subprocess(command: string): Promise<[string, string]> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.warn(error);
          reject(stderr);
        }
        resolve([stdout, stderr]);
      });
    });
  }

  async getBranch(dir: string): Promise<string> {
    return this.ideUtils.getBranch(vscode.Uri.file(dir));
  }
}

export { VsCodeIde };
