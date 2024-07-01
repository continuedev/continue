import { ContinueConfig, ContinueRcJson, IDE, IdeSettings } from "../..";
import { Telemetry } from "../../util/posthog";
import { loadFullConfigNode } from "../load";
import { IProfileLoader } from "./IProfileLoader";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";
  profileId = LocalProfileLoader.ID;
  profileTitle = "config.json";

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    // private controlPlaneClient: ControlPlaneClient,
    private writeLog: (message: string) => Promise<void>,
  ) {}

  async doLoadConfig(): Promise<ContinueConfig> {
    let workspaceConfigs: ContinueRcJson[] = [];
    try {
      workspaceConfigs = await this.ide.getWorkspaceConfigs();
    } catch (e) {
      console.warn("Failed to load workspace configs");
    }

    const ideInfo = await this.ide.getIdeInfo();
    const uniqueId = await this.ide.getUniqueId();
    const ideSettings = await this.ideSettingsPromise;

    const newConfig = await loadFullConfigNode(
      this.ide,
      workspaceConfigs,
      ideSettings,
      ideInfo.ideType,
      uniqueId,
      this.writeLog,
    );
    newConfig.allowAnonymousTelemetry =
      newConfig.allowAnonymousTelemetry &&
      (await this.ide.isTelemetryEnabled());

    // Setup telemetry only after (and if) we know it is enabled
    await Telemetry.setup(
      newConfig.allowAnonymousTelemetry ?? true,
      await this.ide.getUniqueId(),
      ideInfo.extensionVersion,
    );

    return newConfig;
  }

  setIsActive(isActive: boolean): void {}
}
