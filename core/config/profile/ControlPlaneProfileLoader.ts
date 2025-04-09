import { ConfigJson } from "@continuedev/config-types";
import { ConfigResult } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { PRODUCTION_ENV } from "../../control-plane/env.js";
import {
  ContinueConfig,
  IDE,
  IdeSettings,
  ILLMLogger,
  SerializedContinueConfig,
} from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class ControlPlaneProfileLoader implements IProfileLoader {
  private static RELOAD_INTERVAL = 1000 * 60 * 15; // every 15 minutes

  description: ProfileDescription;

  workspaceSettings: ConfigJson | undefined;

  constructor(
    private readonly workspaceId: string,
    private workspaceTitle: string,
    private readonly controlPlaneClient: ControlPlaneClient,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private llmLogger: ILLMLogger,
    private readonly onReload: () => void,
  ) {
    this.description = {
      id: workspaceId,
      profileType: "control-plane",
      iconUrl: "",
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      title: workspaceTitle,
      errors: undefined,
      uri: `${PRODUCTION_ENV.APP_URL}workspaces/${workspaceId}`,
    };

    setInterval(async () => {
      this.workspaceSettings =
        await this.controlPlaneClient.getSettingsForWorkspace(
          this.description.id,
        );
      this.onReload();
    }, ControlPlaneProfileLoader.RELOAD_INTERVAL);
  }

  async doLoadConfig(): Promise<ConfigResult<ContinueConfig>> {
    const settings =
      this.workspaceSettings ??
      ((await this.controlPlaneClient.getSettingsForWorkspace(
        this.description.id,
      )) as any);
    const serializedConfig: SerializedContinueConfig = settings;

    return await doLoadConfig({
      ide: this.ide,
      ideSettingsPromise: this.ideSettingsPromise,
      controlPlaneClient: this.controlPlaneClient,
      llmLogger: this.llmLogger,
      overrideConfigJson: serializedConfig,
      overrideConfigYaml: undefined,
      platformConfigMetadata: undefined,
      profileId: this.workspaceId,
      overrideConfigYamlByPath: undefined,
      orgScopeId: null,
    });
  }

  setIsActive(isActive: boolean): void {}
}
