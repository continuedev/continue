import { ContinueConfig, ContinueRcJson, IDE, ILLM, IContextProvider } from "../index.js";
import { IdeSettings } from "../protocol.js";
import { Telemetry } from "../util/posthog.js";
import {
  BrowserSerializedContinueConfig,
  finalToBrowserConfig,
  loadFullConfigNode,
} from "./load.js";

export class ConfigHandler {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private additionalContextProviders: IContextProvider[] = [];

  constructor(
    private readonly ide: IDE,
    private ideSettings: IdeSettings,
    private readonly writeLog: (text: string) => Promise<void>,
    private readonly onConfigUpdate: () => void,
  ) {
    this.ide = ide;
    this.ideSettings = ideSettings;
    this.writeLog = writeLog;
    this.onConfigUpdate = onConfigUpdate;
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettings = ideSettings;
    this.reloadConfig();
  }

  reloadConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.loadConfig();
    this.onConfigUpdate();
  }

  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      this.savedConfig = await this.loadConfig();
      this.savedBrowserConfig = finalToBrowserConfig(this.savedConfig);
    }
    return this.savedBrowserConfig;
  }

  async loadConfig(): Promise<ContinueConfig> {
    if (this.savedConfig) {
      return this.savedConfig;
    }

    let workspaceConfigs: ContinueRcJson[] = [];
    try {
      workspaceConfigs = await this.ide.getWorkspaceConfigs();
    } catch (e) {
      console.warn("Failed to load workspace configs");
    }

    const ideInfo = await this.ide.getIdeInfo();
    const uniqueId = await this.ide.getUniqueId();

    this.savedConfig = await loadFullConfigNode(
      this.ide,
      workspaceConfigs,
      this.ideSettings,
      ideInfo.ideType,
      uniqueId,
      this.writeLog,
    );
    this.savedConfig.allowAnonymousTelemetry =
      this.savedConfig.allowAnonymousTelemetry &&
      (await this.ide.isTelemetryEnabled());

    // Setup telemetry only after (and if) we know it is enabled
    await Telemetry.setup(
      this.savedConfig.allowAnonymousTelemetry ?? true,
      await this.ide.getUniqueId(),
      ideInfo.extensionVersion,
    );

    (this.savedConfig.contextProviders ?? []).push(
      ...this.additionalContextProviders,
    );

    return this.savedConfig;
  }

  async llmFromTitle(title?: string): Promise<ILLM> {
    const config = await this.loadConfig();
    const model =
      config.models.find((m) => m.title === title) || config.models[0];
    if (!model) {
      throw new Error("No model found");
    }

    return model;
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    this.reloadConfig();
  }
}
