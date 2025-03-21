import { ProgressData } from "core/granite/commons/progressData";
import { ServerState } from "core/granite/commons/serverState";
import { ModelStatus } from "core/granite/commons/statuses";

export interface IModelServer {
  getName(): string;
  supportedInstallModes(): Promise<{ id: string; label: string, supportsRefresh: boolean }[]>;
  getState(): Promise<ServerState>;
  isServerInstalled(): Promise<boolean>;
  isServerStarted(): Promise<boolean>;
  startServer(): Promise<boolean>;
  installServer(mode: string, signal: AbortSignal, reportProgress: (progress: ProgressData) => void): Promise<boolean>;
  getModelStatus(modelName?: string): Promise<ModelStatus>;
  pullModels(models: string[], signal: AbortSignal, reportProgress: (progress: ProgressData) => void): Promise<boolean>;
  listModels(): Promise<string[]>;
}
