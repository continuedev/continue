//Mock server for testing
import { CancellationError, env, ExtensionContext, Progress, ProgressLocation, Uri, window } from "vscode";
import { getStandardName } from "core/granite/commons/naming";
import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";
import { IModelServer } from "../modelServer";
import { OllamaServer } from "./ollamaServer";
class MockModel {
  progress: number;
  layers: MockLayer[];
  constructor(public name: string, public size: number, public status: ModelStatus = ModelStatus.missing) {
    this.progress = 0;
    const sizeInBytes = size * 1024 * 1024;
    this.layers = this.generateLayers(sizeInBytes);
  }

  private generateLayers(totalSize: number): MockLayer[] {
    const layerSizes = [0.90, 0.05, 0.03, 0.02];
    return layerSizes.map(percentage => ({
      name: this.generateHash(),
      size: percentage * totalSize,
      progress: 0
    }));
  }

  generateHash(): string {
    return Math.random().toString(36).substring(2, 14);
  }
};
interface MockLayer {
  name: string;
  size: number; // size in bytes
  progress: number; // progress in bytes
}
export class MockServer extends OllamaServer implements IModelServer {
  private mockStatus = ServerStatus.missing;
  private models: Map<string, MockModel> = new Map([
    ["granite-code:3b", new MockModel("granite-code:3b", 2600)],
    ["granite-code:8b", new MockModel("granite-code:8b", 4000)],
    ["granite-code:20b", new MockModel("granite-code:20b", 11000, ModelStatus.installed)],
    ["granite-code:34b", new MockModel("granite-code:34b", 20000)],
    ["nomic-embed-text:latest", new MockModel("nomic-embed-text:latest", 274, ModelStatus.stale)],
  ]);

  /**
   * Creates an instance of MockServer with a specified speed.
   *
   * @param speed - The speed of the server in MB/s. This speed
   *                determines how fast the mock server
   *                will simulate download operations.
   */
  constructor(private speed: number) {
    super({} as ExtensionContext, "Mock Server");
    this.speed *= 1024 * 1024; // Convert speed to bytes per second
  }
  async startServer(): Promise<boolean> {
    this.mockStatus = ServerStatus.started;
    return true;
  }
  async isServerStarted(): Promise<boolean> {
    return this.mockStatus === ServerStatus.started;
  }

  async isServerInstalled(): Promise<boolean> {
    return this.mockStatus === ServerStatus.started || this.mockStatus === ServerStatus.stopped;
  }

  async getStatus(): Promise<ServerStatus> {
    return this.mockStatus;
  }

  async installServer(mode: string): Promise<boolean> {
    switch (mode) {
      case "mock":
        this.mockStatus = ServerStatus.installing;
        return new Promise(async (resolve, reject) => {
          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: `Pretending to install server`,
            },
            async (windowProgress, token) => {
              token.onCancellationRequested(() => {
                console.log("Installation cancelled");
                reject(new CancellationError());
              });

              const desiredDuration = 4000; // 4 seconds
              const interval = 200; // 200 milliseconds
              const totalSteps = desiredDuration / interval;
              const increment = 100 / totalSteps;

              let progress = 0;
              const updateProgress = async () => {
                if (progress < 100) {
                  progress += increment;
                  windowProgress.report({ increment });
                  await new Promise(resolve => setTimeout(resolve, interval));
                  await updateProgress();
                } else {
                  this.mockStatus = ServerStatus.started;
                  resolve(true);
                }
              };

              await updateProgress();
            }
          );
        });
      case "manual":
      default:
        await env.openExternal(Uri.parse("https://ollama.com/download"));
        this.mockStatus = ServerStatus.started;
        return true;
    }
  }
  private getModel(modelName: string): MockModel {
    const fullModelName = getStandardName(modelName);
    const model = this.models.get(fullModelName);
    if (!model) {
      throw new Error(`Model ${fullModelName} not found`);
    }
    return model;
  }

  async getModelStatus(modelName?: string): Promise<ModelStatus> {
    if (!modelName || !(await this.isServerStarted())) {
      return ModelStatus.unknown;
    }
    // Check if the model is currently being installed
    if (this.installingModels.has(modelName)) {
      return ModelStatus.installing;
    }
    return this.getModel(modelName).status;
  }

  async cancellablePullModel(modelName: string, progressReporter: Progress<ProgressData>, token: any): Promise<void> {
    const model = this.getModel(modelName);
    if (model.status === ModelStatus.installed) {
      return;
    }

    const steps = [
      { name: "Pulling manifest", duration: 1000 },
      ...model.layers.map(layer => ({ name: `Pulling ${layer.name}...`, layer })),
      { name: "Verifying sha256 digest", duration: 1000 },
      { name: "Writing manifest", duration: 1000 },
      { name: "Success", duration: 1000 }
    ];

    for (const step of steps) {
      if (token.isCancellationRequested) {
        return;
      }

      if ('layer' in step) {
        await this.simulateDownload(model.name, step.layer, progressReporter, token);
      } else {
        await this.simulateStep(model.name, step.name, step.duration, progressReporter);
      }
    }
    model.status = ModelStatus.installed;
  }

  private async simulateStep(modelName: string, status: string, duration: number, progressReporter: Progress<ProgressData>): Promise<void> {
    return new Promise(resolve => {
      progressReporter.report({ key: modelName, status, increment: -100 });
      progressReporter.report({ key: modelName, status, increment: 1 });
      setTimeout(() => {
        progressReporter.report({ key: modelName, status, increment: 100 });
        resolve();
      }, duration);
    });
  }

  private async simulateDownload(modelName: string, layer: MockLayer, progressReporter: Progress<ProgressData>, token: any): Promise<void> {
    let lastUpdate = Date.now();
    const status = `Pulling ${layer.name}...`;
    progressReporter.report({ key: modelName, status, increment: -100 });

    return new Promise((resolve, reject) => {
      const updateProgress = () => {
        if (token.isCancellationRequested) {
          reject('Download Canceled');
          return;
        }

        const now = Date.now();
        const interval = now - lastUpdate;
        lastUpdate = now;

        const added = Math.min(this.speed * (interval / 1000), layer.size - layer.progress);
        layer.progress += added;
        const increment = Math.round(100 * added / layer.size);

        progressReporter.report({
          key: modelName,
          status,
          increment,
          completed: layer.progress,
          total: layer.size
        });

        // Throw error if model is "granite-code:34b" and we reach 10% progress
        if (modelName === "granite-code:34b" && layer.progress / layer.size >= 0.1) {
          reject(new Error('Simulated error: Insufficient space while pulling granite-code:34b.'));
          return;
        }

        if (layer.progress >= layer.size) {
          resolve();
        } else {
          setTimeout(updateProgress, 100);
        }
      };

      updateProgress();
    });
  }

  async supportedInstallModes(): Promise<{ id: string; label: string; supportsRefresh: boolean }[]> {
    return Promise.resolve([{ id: 'mock', label: 'Install Magically', supportsRefresh: true }, { id: 'manual', label: 'Install Manually', supportsRefresh: true }]);
  }

  async listModels(): Promise<string[]> {
    if (!this.isServerInstalled()) {
      throw new Error("Server is not installed");
    }
    return Array.from(this.models.values()).filter(model => model.status !== ModelStatus.missing).map(model => model.name);
  }

  async configureAssistant(
    chatModelName: string | null,
    tabModelName: string | null,
    embeddingsModelName: string | null
  ): Promise<void> {
    // Throw an error if conflicting models are selected
    if (chatModelName === "granite-code:3b" && tabModelName === "granite-code:20b") {
      throw new Error('Simulated error: Conflicting models selected for chat and tab completion.');
    }
    super.configureAssistant(chatModelName, tabModelName, embeddingsModelName);
  }
}