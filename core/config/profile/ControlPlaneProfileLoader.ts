import {
  ContinueConfig,
  IDE,
  IdeSettings,
  SerializedContinueConfig,
} from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import { ControlPlaneSettings } from "../../control-plane/schema";
import { TeamAnalytics } from "../../control-plane/TeamAnalytics";
import { Telemetry } from "../../util/posthog";
import {
  defaultContextProvidersJetBrains,
  defaultContextProvidersVsCode,
  defaultSlashCommandsJetBrains,
  defaultSlashCommandsVscode,
} from "../default";
import {
  intermediateToFinalConfig,
  serializedToIntermediateConfig,
} from "../load";
import { IProfileLoader } from "./IProfileLoader";

export default class ControlPlaneProfileLoader implements IProfileLoader {
  private static RELOAD_INTERVAL = 1000 * 60 * 15; // every 15 minutes

  readonly profileId: string;
  profileTitle: string;

  workspaceSettings: ControlPlaneSettings | undefined;

  constructor(
    private readonly workspaceId: string,
    private workspaceTitle: string,
    private readonly controlPlaneClient: ControlPlaneClient,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private writeLog: (message: string) => Promise<void>,
    private readonly onReload: () => void,
  ) {
    this.profileId = workspaceId;
    this.profileTitle = workspaceTitle;

    setInterval(async () => {
      this.workspaceSettings =
        await this.controlPlaneClient.getSettingsForWorkspace(this.profileId);
      this.onReload();
    }, ControlPlaneProfileLoader.RELOAD_INTERVAL);
  }

  async doLoadConfig(): Promise<ContinueConfig> {
    const ideInfo = await this.ide.getIdeInfo();
    const settings =
      this.workspaceSettings ??
      (await this.controlPlaneClient.getSettingsForWorkspace(this.profileId));

    // First construct a SerializedContinueConfig from the ControlPlaneSettings
    const serializedConfig: SerializedContinueConfig = {
      models: settings.models,
      tabAutocompleteModel: settings.tabAutocompleteModel,
      embeddingsProvider: settings.embeddingsModel,
      reranker: settings.reranker,
    };

    serializedConfig.contextProviders ??=
      ideInfo.ideType === "vscode"
        ? defaultContextProvidersVsCode
        : defaultContextProvidersJetBrains;
    serializedConfig.slashCommands ??=
      ideInfo.ideType === "vscode"
        ? defaultSlashCommandsVscode
        : defaultSlashCommandsJetBrains;

    const intermediateConfig = await serializedToIntermediateConfig(
      serializedConfig,
      this.ide,
    );

    const uniqueId = await this.ide.getUniqueId();
    const finalConfig = await intermediateToFinalConfig(
      intermediateConfig,
      this.ide,
      await this.ideSettingsPromise,
      uniqueId,
      this.writeLog,
    );

    // Set up team analytics/telemetry
    await Telemetry.setup(true, uniqueId, ideInfo.extensionVersion);
    await TeamAnalytics.setup(
      settings.analytics,
      uniqueId,
      ideInfo.extensionVersion,
    );

    return finalConfig;
  }

  setIsActive(isActive: boolean): void {}
}
