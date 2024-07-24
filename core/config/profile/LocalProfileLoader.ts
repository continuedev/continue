import { ContinueConfig, IDE, IdeSettings } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import doLoadConfig from "./doLoadConfig";
import { IProfileLoader } from "./IProfileLoader";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";
  profileId = LocalProfileLoader.ID;
  profileTitle = "Local Config";

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private controlPlaneClient: ControlPlaneClient,
    private writeLog: (message: string) => Promise<void>,
  ) {}

  async doLoadConfig(): Promise<ContinueConfig> {
    return doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      this.controlPlaneClient,
      this.writeLog,
      undefined,
    );
  }

  setIsActive(isActive: boolean): void {}
}
