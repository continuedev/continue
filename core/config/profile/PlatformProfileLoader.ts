import { ClientConfigYaml } from "@continuedev/config-yaml/dist/schemas/index.js";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings } from "../../index.js";

import { ConfigResult } from "@continuedev/config-yaml";
import { ProfileDescription } from "../ProfileLifecycleManager.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

/**
 * Metadata about the package that is currently being loaded
 * If this is `undefined`, it's not a config from the platform,
 * could be local for example.
 */
export interface PlatformConfigMetadata {
  ownerSlug: string;
  packageSlug: string;
}

export default class PlatformProfileLoader implements IProfileLoader {
  static RELOAD_INTERVAL = 1000 * 60 * 15; // every 15 minutes

  description: ProfileDescription;

  constructor(
    private configResult: ConfigResult<ClientConfigYaml>,
    private readonly ownerSlug: string,
    private readonly packageSlug: string,
    private readonly controlPlaneClient: ControlPlaneClient,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private writeLog: (message: string) => Promise<void>,
    private readonly onReload: () => void,
  ) {
    this.description = {
      id: `${ownerSlug}/${packageSlug}`,
      title: `${ownerSlug}/${packageSlug}`,
      errors: configResult.errors,
    };

    setInterval(async () => {
      const assistants = await this.controlPlaneClient.listAssistants();
      const newConfigResult = assistants.find(
        (assistant) =>
          assistant.packageSlug === this.packageSlug &&
          assistant.ownerSlug === this.ownerSlug,
      )?.configResult;
      if (!newConfigResult) {
        return;
      }
      this.configResult = {
        config: newConfigResult.config,
        errors: newConfigResult.errors,
        configLoadInterrupted: false,
      };
      this.onReload();
    }, PlatformProfileLoader.RELOAD_INTERVAL);
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    if (this.configResult.errors?.length) {
      return {
        config: undefined,
        errors: this.configResult.errors,
        configLoadInterrupted: false,
      };
    }

    const results = await doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      this.controlPlaneClient,
      this.writeLog,
      undefined,
      this.configResult.config,
      {
        ownerSlug: this.ownerSlug,
        packageSlug: this.packageSlug,
      },
    );

    return {
      ...results,
      errors: [], // Don't do config validation here, it happens in admin panel
    };
  }

  setIsActive(isActive: boolean): void {}
}
