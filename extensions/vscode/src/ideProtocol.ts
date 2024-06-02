import * as child_process from "node:child_process";
import { exec } from "node:child_process";
import * as path from "node:path";

import type {
  ContinueRcJson,
  FileType,
  IDE,
  IdeInfo,
  IndexTag,
  Problem,
  Range,
  Thread,
} from "core";
import { defaultIgnoreFile } from "core/indexing/ignore";
import { IdeSettings } from "core/protocol/ideWebview";
import {
  editConfigJson,
  getConfigJsonPath,
  getContinueGlobalPath,
} from "core/util/paths";
import * as vscode from "vscode";
import { DiffManager } from "./diff/horizontal";
import { Repository } from "./otherExtensions/git";
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

  private authToken: string | undefined;
  private askedForAuth = false;

  async getGitHubAuthToken(): Promise<string | undefined> {
    if (this.authToken) {
      return this.authToken;
    }
    try {
      const session = await vscode.authentication.getSession("github", [], {
        silent: this.askedForAuth,
        createIfNone: !this.askedForAuth,
      });
      if (session) {
        this.authToken = session.accessToken;
        return session.accessToken;
      } else if (!this.askedForAuth) {
        // User cancelled the login prompt
        // Explain that they can avoid the prompt by removing free trial models from config.json
        vscode.window
          .showInformationMessage(
            "We'll only ask you to log in if using the free trial. To avoid this prompt, make sure to remove free trial models from your config.json",
            "Remove for me",
            "Open config.json",
          )
          .then((selection) => {
            if (selection === "Remove for me") {
              editConfigJson((configJson) => {
                configJson.models = configJson.models.filter(
                  (model) => model.provider !== "free-trial",
                );
                configJson.tabAutocompleteModel = undefined;
                return configJson;
              });
            } else if (selection === "Open config.json") {
              this.openFile(getConfigJsonPath());
            }
          });
      }
    } catch (error) {
      console.error("Failed to get GitHub authentication session:", error);
    } finally {
      this.askedForAuth = true;
    }
    return undefined;
  }

  async infoPopup(message: string): Promise<void> {
    vscode.window.showInformationMessage(message);
  }

  async errorPopup(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    const repo = await this.getRepo(vscode.Uri.file(dir));
    const remotes = repo?.state.remotes;
    if (!remotes) {
      return undefined;
    }
    const remote =
      remotes?.find((r: any) => r.name === "origin") ?? remotes?.[0];
    if (!remote) {
      return undefined;
    }
    const ownerAndRepo = remote.fetchUrl
      ?.replace(".git", "")
      .split("/")
      .slice(-2);
    return ownerAndRepo?.join("/");
  }

  async getTags(artifactId: string): Promise<IndexTag[]> {
    const workspaceDirs = await this.getWorkspaceDirs();

    const branches = await Promise.all(
      workspaceDirs.map((dir) => this.getBranch(dir)),
    );

    const tags: IndexTag[] = workspaceDirs.map((directory, i) => ({
      directory,
      branch: branches[i],
      artifactId,
    }));

    return tags;
  }
  getIdeInfo(): Promise<IdeInfo> {
    return Promise.resolve({
      ideType: "vscode",
      name: vscode.env.appName,
      version: vscode.version,
      remoteName: vscode.env.remoteName || "local",
      extensionVersion:
        vscode.extensions.getExtension("continue.continue")?.packageJSON
          .version,
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

  async getLastModified(files: string[]): Promise<{ [path: string]: number }> {
    const pathToLastModified: { [path: string]: number } = {};
    await Promise.all(
      files.map(async (file) => {
        const stat = await vscode.workspace.fs.stat(uriFromFilePath(file));
        pathToLastModified[file] = stat.mtime;
      }),
    );

    return pathToLastModified;
  }

  async getRepo(dir: vscode.Uri): Promise<Repository | undefined> {
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

  async getDebugLocals(threadIndex: number): Promise<string> {
    return await this.ideUtils.getDebugLocals(threadIndex);
  }

  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]> {
    return await this.ideUtils.getTopLevelCallStackSources(
      threadIndex,
      stackDepth,
    );
  }
  async getAvailableThreads(): Promise<Thread[]> {
    return await this.ideUtils.getAvailableThreads();
  }

  async listWorkspaceContents(
    directory?: string,
    useGitIgnore?: boolean,
  ): Promise<string[]> {
    if (directory) {
      return await this.ideUtils.getDirectoryContents(
        directory,
        true,
        useGitIgnore ?? true,
      );
    }
    const contents = await Promise.all(
      this.ideUtils
        .getWorkspaceDirectories()
        .map((dir) =>
          this.ideUtils.getDirectoryContents(dir, true, useGitIgnore ?? true),
        ),
    );
    return contents.flat();
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
        true,
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
      const terminal =
        vscode.window.activeTerminal ?? vscode.window.terminals[0];
      terminal.show();
      terminal.sendText(command, false);
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

  async getCurrentFile(): Promise<string | undefined> {
    return vscode.window.activeTextEditor?.document.uri.fsPath;
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
        "out",
        "node_modules",
        "@vscode",
        "ripgrep",
        "bin",
        "rg",
      ),
      ["-i", "-C", "2", "--", `${query}`, "."], //no regex
      //["-i", "-C", "2", "-e", `${query}`, "."], //use regex
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
    const results = [];
    for (const dir of await this.getWorkspaceDirs()) {
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

  getGitRootPath(dir: string): Promise<string | undefined> {
    return this.ideUtils.getGitRoot(dir);
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    const files = await vscode.workspace.fs.readDirectory(uriFromFilePath(dir));
    return files
      .filter(([name, type]) => {
        !(type === vscode.FileType.File && defaultIgnoreFile.ignores(name));
      })
      .map(([name, type]) => [path.join(dir, name), type]) as any;
  }

  getIdeSettings(): IdeSettings {
    const settings = vscode.workspace.getConfiguration("continue");
    const remoteConfigServerUrl = settings.get<string | undefined>(
      "remoteConfigServerUrl",
      undefined,
    );
    const ideSettings: IdeSettings = {
      remoteConfigServerUrl,
      remoteConfigSyncPeriod: settings.get<number>(
        "remoteConfigSyncPeriod",
        60,
      ),
      userToken: settings.get<string>("userToken", ""),
    };
    return ideSettings;
  }
}

export { VsCodeIde };
