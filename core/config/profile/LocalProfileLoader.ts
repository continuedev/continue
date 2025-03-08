import { ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";
  description: ProfileDescription = {
    id: LocalProfileLoader.ID,
    profileType: "local",
    fullSlug: {
      ownerSlug: "",
      packageSlug: "",
      versionSlug: "",
    },
    iconUrl: "",
    title: "Local Config",
    errors: undefined,
  };

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private controlPlaneClient: ControlPlaneClient,
    private writeLog: (message: string) => Promise<void>,
  ) {}

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    const result = await doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      this.controlPlaneClient,
      this.writeLog,
      undefined,
      undefined,
      undefined,
      this.description.id,
    );

    this.description.errors = result.errors;

    return result;
  }

  setIsActive(isActive: boolean): void {}
}
