import os from "os";
import path from 'path';
import { CancellationError, env, ExtensionContext, Progress, ProgressLocation, Uri, window } from "vscode";
import { EXTENSION_ID } from "core/granite/commons/constants";
import { DEFAULT_MODEL_INFO, ModelInfo } from "core/granite/commons/modelInfo";
import { getStandardName } from "core/granite/commons/naming";
import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";
import { AiAssistantConfigurator } from "../configureAssistant";
import { IModelServer } from "../modelServer";
import { terminalCommandRunner } from "../terminal/terminalCommandRunner";
import { executeCommand } from "../utils/cpUtils";
import { downloadFileFromUrl } from "../utils/downloadUtils";
import { getRemoteModelInfo } from "./ollamaLibrary";

const PLATFORM = os.platform();

export class OllamaServer implements IModelServer {

  private currentStatus = ServerStatus.unknown;
  protected installingModels = new Set<string>();
  private modelInfoPromises: Map<string, Promise<ModelInfo | undefined>> = new Map();
  private modelInfoResults: Map<string, ModelInfo | undefined> = new Map();
  constructor(private context: ExtensionContext, private name: string = "Ollama", private serverUrl = "http://localhost:11434") { }

  getName(): string {
    return this.name;
  }

  async supportedInstallModes(): Promise<{ id: string; label: string, supportsRefresh: boolean }[]> {
    const modes = [];
    if (isLinux()) {
      if (isDevspaces()) {
        // sudo is not available in devspaces, so we can't use ollama's or manual install script
        return [{ id: "devspaces", label: "See Red Hat Dev Spaces instructions", supportsRefresh: false }];
      } else {
        // on linux
        modes.push({ id: "script", label: "Install with script", supportsRefresh: true });
      }
    }
    if (await isHomebrewAvailable()) {
      // homebrew is available
      modes.push({ id: "homebrew", label: "Install with Homebrew", supportsRefresh: true });
    }
    if (isWin()) {
      modes.push({ id: "windows", label: "Install automatically", supportsRefresh: true });
    }
    modes.push({ id: "manual", label: "Install manually", supportsRefresh: true });
    return modes;
  }

  async getStatus(): Promise<ServerStatus> {
    let isStarted = false;
    try {
      isStarted = await this.isServerStarted();
    } catch (e) {
    }
    if (isStarted) {
      this.currentStatus = ServerStatus.started;
    } else {
      const ollamaInstalled = await this.isServerInstalled();
      if (this.currentStatus !== ServerStatus.installing) {
        this.currentStatus = (ollamaInstalled) ? ServerStatus.stopped : ServerStatus.missing;
      }
    }
    return this.currentStatus;
  }

  async isServerInstalled(): Promise<boolean> {
    //check if ollama is installed
    try {
      await executeCommand("ollama", ["-v"]);
      //console.log("Ollama is installed");
      return true;
    } catch (error: any) {
      console.log("Ollama is NOT installed: " + error?.message);
      return false;
    }
  }

  async isServerStarted(): Promise<boolean> {
    //check if ollama is installed
    try {
      await this.getTags();
      //console.log("Ollama server is started");
      return true;
    } catch (error: any) {
      //TODO Check error
      console.log("Ollama server is NOT started", error?.message);
      return false;
    }
  }

  async startServer(): Promise<boolean> {
    let startCommand: string | undefined;
    if (isWin()) {
      startCommand = [
        `$ErrorActionPreference = "Stop"`,
        `& "ollama app.exe"`,
      ].join(' ; ');
    } else if (isMac()) {
      startCommand = [
        'set -e',  // Exit immediately if a command exits with a non-zero status
        'open -a Ollama.app',
      ].join(' && ');
    } else {//Linux
      const start_ollama_sh = path.join(this.context.extensionPath, 'start_ollama.sh');
      startCommand = [
        'set -e',  // Exit immediately if a command exits with a non-zero status
        `chmod +x "${start_ollama_sh}"`,  // Ensure the script is executable
        `"${start_ollama_sh}"`,  // Use quotes in case the path contains spaces
      ].join(' && ');
    }
    if (startCommand) {
      await terminalCommandRunner.runInTerminal(
        startCommand,
        {
          name: "Start Ollama",
          show: true,
        }
      );
      return true;
    }
    return false;
  }

  async installServer(mode: string): Promise<boolean> {
    let installCommand: string | undefined;
    switch (mode) {
      case "devspaces": {
        env.openExternal(Uri.parse("https://developers.redhat.com/articles/2024/08/12/integrate-private-ai-coding-assistant-ollama"));
        return false;
      }
      case "homebrew": {
        installCommand = [
          'clear',
          'set -e',  // Exit immediately if a command exits with a non-zero status
          'brew install --cask ollama',
          'sleep 3',
          'ollama list',  // run ollama list to start the server
        ].join(' && ');
        break;
      }
      case "script":
        const start_ollama_sh = path.join(this.context.extensionPath, 'start_ollama.sh');
        installCommand = [
          'clear',
          'set -e',  // Exit immediately if a command exits with a non-zero status
          'command -v curl >/dev/null 2>&1 || { echo >&2 "curl is required but not installed. Aborting."; exit 1; }',
          'curl -fsSL https://ollama.com/install.sh | sh',
          `chmod +x "${start_ollama_sh}"`,  // Ensure the script is executable
          `"${start_ollama_sh}"`,  // Use quotes in case the path contains spaces
        ].join(' && ');
        break;
      case "windows":
        this.currentStatus = ServerStatus.installing;
        const ollamaInstallerPath = await this.downloadOllamaInstaller();
        if (!ollamaInstallerPath) {
          return false;
        }
        //At this point the file is guaranteed to exist
        installCommand = [
          'clear',
          `$ErrorActionPreference = "Stop"`,
          `& "${ollamaInstallerPath}" /Silent`,
          `$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")`, // refresh environment variables in the terminal
        ].join(' ; ');
        break;
      case "manual":
      default:
        env.openExternal(Uri.parse("https://ollama.com/download"));
        return true;
    }
    if (installCommand) {
      this.currentStatus = ServerStatus.installing;//We need to detect the terminal output to know when installation stopped (successfully or not)
      await terminalCommandRunner.runInTerminal(
        installCommand,
        {
          name: "Granite Models Setup",
          show: true,
        }
      );
    }
    return true;
  }

  async downloadOllamaInstaller(): Promise<string | undefined> {
    return await window.withProgress({
      location: ProgressLocation.Notification,
      title: `Downloading Ollama`,
      cancellable: true,
    }, async (progress, token) => {
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const ollamaInstallerPath = path.join(os.tmpdir(), EXTENSION_ID, `OllamaSetup-${randomSuffix}.exe`);
      await downloadFileFromUrl("https://ollama.com/download/OllamaSetup.exe", ollamaInstallerPath, token, progress);
      return ollamaInstallerPath;
    });
  }


  async getModelStatus(modelName?: string): Promise<ModelStatus> {
    if (!modelName || this.currentStatus !== ServerStatus.started) {
      return ModelStatus.unknown;
    }
    // Check if the model is currently being installed
    if (this.installingModels.has(modelName)) {
      return ModelStatus.installing;
    }

    let status = ModelStatus.missing;
    try {
      const models = await this.getTags();
      modelName = getStandardName(modelName);
      const model = models.find((tag: any) => tag.name === modelName);
      if (model) {
        status = ModelStatus.installed;
        // Query the model info - once - from the remote server, in the background, to avoid blocking the UI.
        // modelInfoResults will be updated with the most recent info once it's available
        if (!this.modelInfoPromises.has(modelName)) {
          this.modelInfoPromises.set(modelName, this.fetchModelInfo(modelName));
        }
        //It's installed, but is it the most recent version?
        const cachedInfo = this.modelInfoResults.get(modelName);
        //cachedInfo.digest should be a substring of model.digest if the model is not stale
        if (cachedInfo && !model.digest.startsWith(cachedInfo.digest)) {
          // Since the digests differ, we assume a more recent version is available
          status = ModelStatus.stale;
        }
      }
    } catch (error) {
      console.log(`Error getting ${modelName} status:`, error);
      status = ModelStatus.unknown;
    }
    return status;
  }

  private cachedTags?: { timestamp: number, tags: any[] };

  async getTags(): Promise<any[]> {
    if (!this.cachedTags || (Date.now() - this.cachedTags.timestamp) > 100) {//cache for 100ms
      this.cachedTags = {
        timestamp: Date.now(),
        tags: await this._getTags(),
      };
    }
    return this.cachedTags.tags;
  }

  async _getTags(): Promise<any[]> {
    const json = (
      await fetch(`${this.serverUrl}/api/tags`)
    ).json() as any;
    const rawModels = (await json)?.models || [];
    return rawModels;
  }

  async listModels(): Promise<string[]> {
    const json = (
      await fetch(`${this.serverUrl}/v1/models`)
    ).json() as any;
    const rawModels = (await json)?.data;
    const models = rawModels ? rawModels.map((model: any) => model.id) : [];
    return models;
  }

  async installModel(modelName: string, reportProgress: (progress: ProgressData) => void): Promise<any> {
    await this.pullModel(modelName, reportProgress);
    console.log(`${modelName} was pulled`);
  }

  async configureAssistant(
    chatModel: string | null,
    tabCompletionModel: string | null,
    embeddingsModel: string | null
  ): Promise<void> {
    const assistantConfigurator = new AiAssistantConfigurator({
      chatModel,
      tabCompletionModel,
      embeddingsModel
    });
    await assistantConfigurator.configureAssistant();
  }

  async pullModel(modelName: string, reportProgress: (progress: ProgressData) => void): Promise<void> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Installing model '${modelName}'`,
        cancellable: true,
      },
      async (windowProgress, token) => {
        let isCancelled = false;

        token.onCancellationRequested(() => {
          console.log(`Pulling ${modelName} model was cancelled`);
          isCancelled = true;
        });

        const progressWrapper: Progress<ProgressData> = {
          report: (data) => {
            const completed = data.completed ? data.completed : 0;
            const totalSize = data.total ? data.total : 0;
            let message = data.status;
            if (totalSize > 0) {
              const progressValue = Math.round((completed / totalSize) * 100);
              message = `${message} ${progressValue}%`;
            }
            //report to vscode progress notification
            windowProgress.report({ increment: data.increment, message });
            //report to progress object
            reportProgress(data);
          },
        };

        try {
          this.installingModels.add(modelName);
          await this.cancellablePullModel(modelName, progressWrapper, token);
          if (isCancelled) {
            throw new CancellationError();
          }
        } catch (error) {
          if (isCancelled) {
            throw new CancellationError();
          }
          throw error; // Re-throw other errors
        } finally {
          // Remove from installingModels once installation completes (success or error)
          this.installingModels.delete(modelName);
        }
      }
    );
  }


  async cancellablePullModel(modelName: string, progress: Progress<ProgressData>, token: any) {
    const response = await fetch(`${this.serverUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    const reader = response.body?.getReader();
    let currentProgress = 0;

    while (true) {
      const { done, value } = await reader?.read() || { done: true, value: undefined };
      if (done) {
        break;
      }

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        const data = JSON.parse(line);
        //console.log(data);
        if (data.total) {
          const completed = data.completed ? data.completed : 0;
          const progressValue = Math.round((completed / data.total) * 100);
          const increment = progressValue - currentProgress;
          currentProgress = progressValue;

          progress.report({
            key: modelName,
            increment,
            completed,
            total: data.total,
            status: data.status,
          });
        } else {
          progress.report({ key: modelName, increment: 0, status: data.status });
        }
      }

      if (token.isCancellationRequested) {
        reader?.cancel();
        break;
      }
    }
  }

  async getModelInfo(modelName: string): Promise<ModelInfo | undefined> {
    let modelInfo: ModelInfo | undefined;
    try {
      modelInfo = await getRemoteModelInfo(modelName);
    } catch (error) {
      console.log(`Failed to retrieve remote model info for ${modelName}: ${error}`);
    }
    return modelInfo || DEFAULT_MODEL_INFO.get(modelName);
  }

  private async fetchModelInfo(modelName: string): Promise<ModelInfo | undefined> {
    try {
      const modelInfo = await getRemoteModelInfo(modelName);
      this.modelInfoResults.set(modelName, modelInfo);
      return modelInfo;
    } catch (error) {
      console.log(`Failed to retrieve remote model info for ${modelName}:`, error);
      return undefined;
    }
  }
}

async function isHomebrewAvailable(): Promise<boolean> {
  if (isWin()) {
    //TODO Would that be an issue on WSL2?
    return false;
  }
  try {
    const result = await executeCommand("which", ["brew"]);
    return "brew not found" !== result;
  } catch (e) {
    return false;
  }
}

function isLinux(): boolean {
  return PLATFORM === "linux";
}

function isWin(): boolean {
  return PLATFORM.startsWith("win");
}

function isMac(): boolean {
  return PLATFORM === "darwin";
}

function isDevspaces() {
  //sudo is not available on Red Hat DevSpaces
  return process.env['DEVWORKSPACE_ID'] !== undefined;
}
