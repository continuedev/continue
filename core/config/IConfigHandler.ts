import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
  IdeSettings,
  ILLM,
} from "../index.js";

export interface IConfigHandler {
  updateIdeSettings(ideSettings: IdeSettings): void;
  onConfigUpdate(listener: (newConfig: ContinueConfig) => void): void;
  reloadConfig(): Promise<void>;
  getSerializedConfig(): Promise<BrowserSerializedContinueConfig>;
  loadConfig(): Promise<ContinueConfig>;
  llmFromTitle(title?: string): Promise<ILLM>;
  registerCustomContextProvider(contextProvider: IContextProvider): void;
}
