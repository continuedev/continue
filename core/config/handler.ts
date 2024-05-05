import type { ContinueConfig, ContinueRcJson, IDE, ILLM } from "..";
import type { IdeSettings } from "../protocol/ideWebview";
import { Telemetry } from "../util/posthog";
import {
  finalToBrowserConfig,
  loadFullConfigNode,
  type BrowserSerializedContinueConfig,
} from "./load";

export class ConfigHandler {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    private readonly onConfigUpdate: () => void,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;
    this.onConfigUpdate = onConfigUpdate;
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
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
    const ideSettings = await this.ideSettingsPromise;
    let remoteConfigServerUrl = undefined;
    try {
      remoteConfigServerUrl =
        typeof ideSettings.remoteConfigServerUrl !== "string" ||
        ideSettings.remoteConfigServerUrl === ""
          ? undefined
          : new URL(ideSettings.remoteConfigServerUrl);
    } catch (e) {}

    this.savedConfig = await loadFullConfigNode(
      this.ide.readFile.bind(this.ide),
      workspaceConfigs,
      remoteConfigServerUrl,
      ideInfo.ideType,
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
}
