import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings } from "../../index.js";
import { ConfigResult } from "../load.js";

import { ConfigYaml } from "@continuedev/config-yaml/dist/schemas/index.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class PlatformProfileLoader implements IProfileLoader {
  private static RELOAD_INTERVAL = 1000 * 60 * 15; // every 15 minutes

  readonly profileId: string;
  profileTitle: string;

  constructor(
    private configYaml: ConfigYaml,
    private readonly ownerSlug: string,
    private readonly packageSlug: string,
    private readonly controlPlaneClient: ControlPlaneClient,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private writeLog: (message: string) => Promise<void>,
    private readonly onReload: () => void,
  ) {
    this.profileId = `${ownerSlug}/${packageSlug}`;
    this.profileTitle = `${ownerSlug}/${packageSlug}`;

    setInterval(async () => {
      const assistants = await this.controlPlaneClient.listAssistants();
      const newConfigYaml = assistants.find(
        (assistant) =>
          assistant.packageSlug === this.packageSlug &&
          assistant.ownerSlug === this.ownerSlug,
      )?.configYaml;
      if (!newConfigYaml) {
        return;
      }
      this.configYaml = newConfigYaml;
      this.onReload();
    }, PlatformProfileLoader.RELOAD_INTERVAL);
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    const results = await doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      this.controlPlaneClient,
      this.writeLog,
      undefined,
      this.configYaml,
    );

    return {
      ...results,
      errors: [], // Don't do config validation here, it happens in admin panel
    };
  }

  setIsActive(isActive: boolean): void {}
}
