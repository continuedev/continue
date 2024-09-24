import { ContinueConfig, IDE, IdeSettings } from "../../index.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";
import { ControlPlaneProvider } from "../../control-plane/provider";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";
  profileId = LocalProfileLoader.ID;
  profileTitle = "Local Config";

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private controlPlaneProviderPromise: Promise<ControlPlaneProvider>,
    private writeLog: (message: string) => Promise<void>,
  ) {}

  async doLoadConfig(): Promise<ContinueConfig> {
    return doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      this.controlPlaneProviderPromise,
      this.writeLog,
      undefined,
    );
  }

  setIsActive(isActive: boolean): void {}
}
