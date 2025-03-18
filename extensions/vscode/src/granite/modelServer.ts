import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";

export interface IModelServer {
  getName(): string;
  supportedInstallModes(): Promise<{ id: string; label: string, supportsRefresh: boolean }[]>;
  getStatus(): Promise<ServerStatus>;
  isServerInstalled(): Promise<boolean>;
  isServerStarted(): Promise<boolean>;
  startServer(): Promise<boolean>;
  installServer(mode: string, signal: AbortSignal, reportProgress: (progress: ProgressData) => void): Promise<boolean>;
  getModelStatus(modelName?: string): Promise<ModelStatus>;
  pullModels(models: string[], signal: AbortSignal, reportProgress: (progress: ProgressData) => void): Promise<boolean>;
  listModels(): Promise<string[]>;
}
