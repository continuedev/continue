import { AssistantUnrolled, ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings } from "../../index.js";

import { ProfileDescription } from "../ProfileLifecycleManager.js";

import { getControlPlaneEnv } from "../../control-plane/env.js";
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
  static RELOAD_INTERVAL = 1000 * 5; // 5 seconds

  private constructor(
    private configResult: ConfigResult<AssistantUnrolled>,
    private readonly ownerSlug: string,
    private readonly packageSlug: string,
    private readonly iconUrl: string,
    private readonly versionSlug: string,
    private readonly controlPlaneClient: ControlPlaneClient,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private writeLog: (message: string) => Promise<void>,
    private readonly onReload: () => void,
    readonly description: ProfileDescription,
  ) {}

  static async create(
    configResult: ConfigResult<AssistantUnrolled>,
    ownerSlug: string,
    packageSlug: string,
    iconUrl: string,
    versionSlug: string,
    controlPlaneClient: ControlPlaneClient,
    ide: IDE,
    ideSettingsPromise: Promise<IdeSettings>,
    writeLog: (message: string) => Promise<void>,
    onReload: () => void,
  ): Promise<PlatformProfileLoader> {
    const controlPlaneEnv = await getControlPlaneEnv(ideSettingsPromise);

    const description: ProfileDescription = {
      id: `${ownerSlug}/${packageSlug}`,
      profileType: "platform",
      fullSlug: {
        ownerSlug,
        packageSlug,
        versionSlug,
      },
      title: configResult.config?.name ?? `${ownerSlug}/${packageSlug}`,
      errors: configResult.errors,
      iconUrl: iconUrl,
      uri: `${controlPlaneEnv}${ownerSlug}/${packageSlug}`,
    };

    return new PlatformProfileLoader(
      configResult,
      ownerSlug,
      packageSlug,
      iconUrl,
      versionSlug,
      controlPlaneClient,
      ide,
      ideSettingsPromise,
      writeLog,
      onReload,
      description,
    );
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    if (this.configResult.errors?.find((e) => e.fatal)) {
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
      this.description.id,
      undefined,
    );

    return {
      config: results.config,
      errors: [...(this.configResult.errors ?? []), ...(results.errors ?? [])],
      configLoadInterrupted: results.configLoadInterrupted,
    };
  }

  setIsActive(isActive: boolean): void {}
}
