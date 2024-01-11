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
import { ContinueConfig, DiffLine, IDE, SerializedContinueConfig } from "core";
import {
  intermediateToFinalConfig,
  serializedToIntermediateConfig,
} from "core/config/load";
import { verticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import mergeJson from "./util/merge";
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
}

async function loadFullConfigNode(ide: IDE): Promise<ContinueConfig> {
  let serialized = await ide.getSerializedConfig();
  let intermediate = serializedToIntermediateConfig(serialized);

  const configJsContents = await buildConfigTs(false);
  if (configJsContents) {
    try {
      // Try config.ts first
      const module = await require(getConfigJsPath(true));
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
