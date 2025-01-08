import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";

export interface IModelServer {
  getName(): string;
  getStatus(): Promise<ServerStatus>;
  startServer(): Promise<boolean>;
  installServer(mode: string): Promise<boolean>;
  getModelStatus(modelName?: string): Promise<ModelStatus>
  installModel(modelName: string, reportProgress: (progress: ProgressData) => void): Promise<any>;
  supportedInstallModes(): Promise<{ id: string; label: string, supportsRefresh: boolean }[]>; //manual, script, homebrew
  configureAssistant(
    chatModel: string | null,
    tabModel: string | null,
    embeddingsModel: string | null
  ): Promise<void>;
  listModels(): Promise<string[]>;
  //getModelInfo(modelName: string): Promise<ModelInfo | undefined>;
}
