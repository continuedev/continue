import { AssistantUnrolled, ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { getControlPlaneEnv } from "../../control-plane/env.js";
import { ContinueConfig, IDE, IdeSettings, ILLMLogger } from "../../index.js";
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
  static RELOAD_INTERVAL = 1000 * 5; // 5 seconds

  private configResult: ConfigResult<AssistantUnrolled>;
  private readonly ownerSlug: string;
  private readonly packageSlug: string;
  private readonly iconUrl: string;
  private readonly versionSlug: string;
  private readonly controlPlaneClient: ControlPlaneClient;
  private readonly ide: IDE;
  private ideSettingsPromise: Promise<IdeSettings>;
  private llmLogger: ILLMLogger;
  readonly description: ProfileDescription;
  private readonly orgScopeId: string | null;

  private constructor({
    configResult,
    ownerSlug,
    packageSlug,
    iconUrl,
    versionSlug,
    controlPlaneClient,
    ide,
    ideSettingsPromise,
    llmLogger,
    description,
    orgScopeId,
  }: {
    configResult: ConfigResult<AssistantUnrolled>;
    ownerSlug: string;
    packageSlug: string;
    iconUrl: string;
    versionSlug: string;
    controlPlaneClient: ControlPlaneClient;
    ide: IDE;
    ideSettingsPromise: Promise<IdeSettings>;
    llmLogger: ILLMLogger;
    description: ProfileDescription;
    orgScopeId: string | null;
  }) {
    this.configResult = configResult;
    this.ownerSlug = ownerSlug;
    this.packageSlug = packageSlug;
    this.iconUrl = iconUrl;
    this.versionSlug = versionSlug;
    this.controlPlaneClient = controlPlaneClient;
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.llmLogger = llmLogger;
    this.description = description;
    this.orgScopeId = orgScopeId;
  }

  static async create({
    configResult,
    ownerSlug,
    packageSlug,
    iconUrl,
    versionSlug,
    controlPlaneClient,
    ide,
    ideSettingsPromise,
    llmLogger,
    rawYaml,
    orgScopeId,
  }: {
    configResult: ConfigResult<AssistantUnrolled>;
    ownerSlug: string;
    packageSlug: string;
    iconUrl: string;
    versionSlug: string;
    controlPlaneClient: ControlPlaneClient;
    ide: IDE;
    ideSettingsPromise: Promise<IdeSettings>;
    llmLogger: ILLMLogger;
    rawYaml: string;
    orgScopeId: string | null;
  }): Promise<PlatformProfileLoader> {
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
      rawYaml,
    };

    return new PlatformProfileLoader({
      configResult,
      ownerSlug,
      packageSlug,
      iconUrl,
      versionSlug,
      controlPlaneClient,
      ide,
      ideSettingsPromise,
      llmLogger,
      description,
      orgScopeId,
    });
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    if (this.configResult.errors?.find((e) => e.fatal)) {
      return {
        config: undefined,
        errors: this.configResult.errors,
        configLoadInterrupted: false,
      };
    }

    const results = await doLoadConfig({
      ide: this.ide,
      ideSettingsPromise: this.ideSettingsPromise,
      controlPlaneClient: this.controlPlaneClient,
      llmLogger: this.llmLogger,
      overrideConfigJson: undefined,
      overrideConfigYaml: this.configResult.config,
      platformConfigMetadata: {
        ownerSlug: this.ownerSlug,
        packageSlug: this.packageSlug,
      },
      profileId: this.description.id,
      overrideConfigYamlByPath: undefined,
      orgScopeId: this.orgScopeId,
    });

    return {
      config: results.config,
      errors: [...(this.configResult.errors ?? []), ...(results.errors ?? [])],
      configLoadInterrupted: results.configLoadInterrupted,
    };
  }

  setIsActive(isActive: boolean): void {}
}
