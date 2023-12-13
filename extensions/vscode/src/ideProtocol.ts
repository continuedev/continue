import { SerializedContinueConfig } from "core/config/index";
import { IDE } from "core/ide/types";
import {
  getConfigJsonPath,
  getConfigTsPath,
  getContinueGlobalPath,
  migrate,
} from "core/util/paths";
import * as fs from "fs";
import * as vscode from "vscode";
import { ideProtocolClient } from "./activation/activate";

class VsCodeIde implements IDE {
  async getSerializedConfig(): Promise<SerializedContinueConfig> {
    const configPath = getConfigJsonPath();
    let contents = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(contents) as SerializedContinueConfig;
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

    return config;
  }

  async getConfigJsUrl(): Promise<string | undefined> {
    if (!fs.existsSync(getConfigTsPath())) {
      return undefined;
    }

    // const result = await esbuild.build({
    //   entryPoints: [getConfigTsPath()],
    //   bundle: true,
    //   platform: "browser",
    //   outfile: getConfigJsPath(),
    //   external: ["esbuild"],
    // });

    // const configJsString = fs.readFileSync(getConfigJsPath(), "utf8");

    // var dataUrl = "data:text/javascript;base64," + btoa(configJsString);
    // return dataUrl;

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

  async listWorkspaceContents(): Promise<string[]> {
    return await ideProtocolClient.getDirectoryContents(
      ideProtocolClient.getWorkspaceDirectory(),
      true
    );
  }

  async getWorkspaceDir(): Promise<string> {
    return ideProtocolClient.getWorkspaceDirectory();
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
}

export default VsCodeIde;
