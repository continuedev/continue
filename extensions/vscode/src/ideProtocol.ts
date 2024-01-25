import { exec } from "child_process";
import defaultConfig from "core/config/default";
import {
  getConfigJsPath,
  getConfigJsonPath,
  getConfigTsPath,
  getContinueGlobalPath,
  migrate,
} from "core/util/paths";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ideProtocolClient } from "./activation/activate";

import * as child_process from "child_process";
import {
  Chunk,
  ContinueConfig,
  DiffLine,
  IDE,
  Problem,
  SerializedContinueConfig,
} from "core";
import {
  intermediateToFinalConfig,
  serializedToIntermediateConfig,
} from "core/config/load";
import { LanceDbIndex } from "core/indexing/LanceDbIndex";
import { IndexTag } from "core/indexing/types";
import { verticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { configHandler } from "./loadConfig";
import mergeJson from "./util/merge";
import { traverseDirectory } from "./util/traverseDirectory";
import { getExtensionUri } from "./util/vscode";

async function buildConfigTs(browser: boolean) {
  if (!fs.existsSync(getConfigTsPath())) {
    return undefined;
  }

  try {
    // Dynamic import esbuild so potentially disastrous errors can be caught
    const esbuild = require("esbuild");

    await esbuild.build({
      entryPoints: [getConfigTsPath()],
      bundle: true,
      platform: browser ? "browser" : "node",
      format: browser ? "esm" : "cjs",
      outfile: getConfigJsPath(!browser),
      external: ["fetch", "fs", "path", "os", "child_process"],
      sourcemap: true,
    });
  } catch (e) {
    console.log(e);
    vscode.window.showErrorMessage(
      "Build error. Please check your ~/.continue/config.ts file: " + e
    );
    return undefined;
  }

  if (!fs.existsSync(getConfigJsPath(!browser))) {
    return undefined;
  }
  return fs.readFileSync(getConfigJsPath(!browser), "utf8");
}

class VsCodeIde implements IDE {
  async getSerializedConfig(): Promise<SerializedContinueConfig> {
    try {
      const configPath = getConfigJsonPath();
      let contents = fs.readFileSync(configPath, "utf8");
      let config = JSON.parse(contents) as SerializedContinueConfig;
      if (config.allowAnonymousTelemetry === undefined) {
        config.allowAnonymousTelemetry = true;
      }
      config.allowAnonymousTelemetry =
        config.allowAnonymousTelemetry &&
        vscode.workspace.getConfiguration("continue").get("telemetryEnabled");

      // Migrate to camelCase - replace all instances of "snake_case" with "camelCase"
      migrate("camelCaseConfig", () => {
        contents = contents
          .replace(/(_\w)/g, function (m) {
            return m[1].toUpperCase();
          })
          .replace("openai-aiohttp", "openai");

        fs.writeFileSync(configPath, contents, "utf8");
      });

      migrate("codebaseContextProvider", () => {
        if (
          !config.contextProviders?.filter((cp) => cp.name === "codebase")
            ?.length
        ) {
          config.contextProviders = [
            ...(config.contextProviders || []),
            {
              name: "codebase",
              params: {},
            },
          ];
        }

        if (!config.embeddingsProvider) {
          config.embeddingsProvider = {
            provider: "transformers.js",
          };
        }

        fs.writeFileSync(
          configPath,
          JSON.stringify(config, undefined, 2),
          "utf8"
        );
      });

      migrate("problemsContextProvider", () => {
        if (
          !config.contextProviders?.filter((cp) => cp.name === "problems")
            ?.length
        ) {
          config.contextProviders = [
            ...(config.contextProviders || []),
            {
              name: "problems",
              params: {},
            },
          ];
        }

        fs.writeFileSync(
          configPath,
          JSON.stringify(config, undefined, 2),
          "utf8"
        );
      });

      migrate("foldersContextProvider", () => {
        if (
          !config.contextProviders?.filter((cp) => cp.name === "folder")?.length
        ) {
          config.contextProviders = [
            ...(config.contextProviders || []),
            {
              name: "folder",
              params: {},
            },
          ];
        }

        fs.writeFileSync(
          configPath,
          JSON.stringify(config, undefined, 2),
          "utf8"
        );
      });

      migrate("renameFreeTrialProvider", () => {
        contents = contents.replace(/openai-free-trial/g, "free-trial");
        fs.writeFileSync(configPath, contents, "utf8");
      });

      for (const workspacePath of await this.getWorkspaceDirs()) {
        const continueRcPath = path.join(workspacePath, ".continuerc.json");
        if (fs.existsSync(continueRcPath)) {
          const continueRc = JSON.parse(
            fs.readFileSync(continueRcPath, "utf8")
          ) as Partial<SerializedContinueConfig>;
          config = mergeJson(config, continueRc);
        }
      }

      return config;
    } catch (e) {
      vscode.window
        .showErrorMessage(
          "Error loading config.json. Please check your config.json file: " + e,
          "Open config.json"
        )
        .then((selection) => {
          if (selection === "Open config.json") {
            vscode.workspace
              .openTextDocument(getConfigJsonPath())
              .then((doc) => {
                vscode.window.showTextDocument(doc);
              });
          }
        });
      return defaultConfig;
    }
  }

  async getConfigJsUrl(): Promise<string | undefined> {
    const configJsString = await buildConfigTs(true);

    if (!configJsString) {
      return undefined;
    }

    var dataUrl = "data:text/javascript;base64," + btoa(configJsString);
    return dataUrl;

    // try {
    //   // Use tsc to compile config.ts to config.js. Spawn a child process to do this
    //   // But we've packaged a file tsc.js in this folder, so just call that
    //   const { spawn } = require("child_process");
    //   const child = spawn(process.execPath, [
    //     __dirname + "/tsc.js",
    //     "--project",
    //     getTsConfigPath(),
    //   ]);

    //   await new Promise((resolve, reject) => {
    //     child.stdout.on("data", (data: any) => {
    //       console.log(`stdout: ${data}`);
    //     });
    //     child.stderr.on("data", (data: any) => {
    //       reject(data);
    //     });
    //     child.on("close", (code: any) => {
    //       console.log(`child process exited with code ${code}`);
    //       resolve(null);
    //     });
    //   });

    //   const configJsString = fs.readFileSync(getConfigJsPath(), "utf8");
    //   var dataUrl = "data:text/javascript;base64," + btoa(configJsString);

    //   return dataUrl;
    // } catch (e) {
    //   console.log(e);
    //   vscode.window.showErrorMessage(
    //     "Error loading config.js. Please check your config.ts file: " + e
    //   );
    //   return undefined;
    // }
  }

  async getDiff(): Promise<string> {
    return await ideProtocolClient.getDiff();
  }

  async getTerminalContents(): Promise<string> {
    return await ideProtocolClient.getTerminalContents(2);
  }

  async listWorkspaceContents(directory?: string): Promise<string[]> {
    if (directory) {
      return await ideProtocolClient.getDirectoryContents(directory, true);
    } else {
      const contents = await Promise.all(
        ideProtocolClient
          .getWorkspaceDirectories()
          .map((dir) => ideProtocolClient.getDirectoryContents(dir, true))
      );
      return contents.flat();
    }
  }

  async listFolders(): Promise<string[]> {
    const allDirs: string[] = [];

    const workspaceDirs = await this.getWorkspaceDirs();
    for (const directory of workspaceDirs) {
      for await (const dir of traverseDirectory(directory, [], false)) {
        allDirs.push(dir);
      }
    }

    return allDirs;
  }

  async getWorkspaceDirs(): Promise<string[]> {
    return ideProtocolClient.getWorkspaceDirectories();
  }

  async getContinueDir(): Promise<string> {
    return getContinueGlobalPath();
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path),
      Buffer.from(contents)
    );
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    ideProtocolClient.showVirtualFile(title, contents);
  }

  async openFile(path: string): Promise<void> {
    ideProtocolClient.openFile(path);
  }

  async runCommand(command: string): Promise<void> {
    await ideProtocolClient.runCommand(command);
  }

  async saveFile(filepath: string): Promise<void> {
    await ideProtocolClient.saveFile(filepath);
  }
  async readFile(filepath: string): Promise<string> {
    return await ideProtocolClient.readFile(filepath);
  }
  async showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void> {
    await ideProtocolClient.showDiff(filepath, newContents, stepIndex);
  }

  async verticalDiffUpdate(
    filepath: string,
    startLine: number,
    endLine: number,
    diffLine: DiffLine
  ) {
    const diffHandler =
      verticalPerLineDiffManager.getOrCreateVerticalPerLineDiffHandler(
        filepath,
        startLine,
        endLine
      );
    if (diffHandler) {
      await diffHandler.handleDiffLine(diffLine);
    }
  }

  async getOpenFiles(): Promise<string[]> {
    return await ideProtocolClient.getOpenFiles();
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
        "rg"
      ),
      ["-i", "-C", "2", `"${query}"`, "."],
      { cwd: dir }
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

  async getFilesToEmbed(
    providerId: string
  ): Promise<[string, string, string][]> {
    return [];
  }

  async sendEmbeddingForChunk(
    chunk: Chunk,
    embedding: number[],
    tags: string[]
  ) {}

  async retrieveChunks(
    text: string,
    n: number,
    directory: string | undefined
  ): Promise<Chunk[]> {
    const embeddingsProvider = (await configHandler.loadConfig(new VsCodeIde()))
      .embeddingsProvider;
    if (!embeddingsProvider) {
      return [];
    }
    const lanceDbIndex = new LanceDbIndex(embeddingsProvider, (path) =>
      ideProtocolClient.readFile(path)
    );

    const tags = await Promise.all(
      (await this.getWorkspaceDirs()).map(async (dir) => {
        let branch = await ideProtocolClient.getBranch(vscode.Uri.file(dir));
        let tag: IndexTag = {
          directory: dir,
          branch,
          artifactId: lanceDbIndex.artifactId,
        };
        return tag;
      })
    );
    let chunks = await lanceDbIndex.retrieve(tags, text, n, directory);
    return chunks as any[];
  }
}

async function loadFullConfigNode(ide: IDE): Promise<ContinueConfig> {
  let serialized = await ide.getSerializedConfig();
  let intermediate = serializedToIntermediateConfig(serialized);

  const configJsContents = await buildConfigTs(false);
  if (configJsContents) {
    try {
      // Try config.ts first
      const configJsPath = getConfigJsPath(true);
      const module = await require(configJsPath);
      delete require.cache[require.resolve(configJsPath)];
      if (!module.modifyConfig) {
        throw new Error("config.ts does not export a modifyConfig function.");
      }
      intermediate = module.modifyConfig(intermediate);
    } catch (e) {
      console.log("Error loading config.ts: ", e);
    }
  }
  const finalConfig = await intermediateToFinalConfig(
    intermediate,
    async (filepath) => {
      return ideProtocolClient.readFile(filepath);
    }
  );
  return finalConfig;
}

export { VsCodeIde, buildConfigTs, loadFullConfigNode };
