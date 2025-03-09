import { ConfigResult, parseConfigYaml } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import { getPrimaryConfigFilePath } from "../../util/paths.js";
import { localPathToUri } from "../../util/pathToUri.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private controlPlaneClient: ControlPlaneClient,
    private writeLog: (message: string) => Promise<void>,
    private overrideAssistantFile?:
      | { path: string; content: string }
      | undefined,
  ) {
    const description: ProfileDescription = {
      id: overrideAssistantFile?.path ?? LocalProfileLoader.ID,
      profileType: "local",
      fullSlug: {
        ownerSlug: "",
        packageSlug: "",
        versionSlug: "",
      },
      iconUrl: "",
      title: overrideAssistantFile?.path ?? "Local Config",
      errors: undefined,
      uri:
        overrideAssistantFile?.path ??
        localPathToUri(getPrimaryConfigFilePath()),
    };
    this.description = description;
    if (overrideAssistantFile?.content) {
      try {
        const parsedAssistant = parseConfigYaml(
          overrideAssistantFile?.content ?? "",
        );
        this.description.title = parsedAssistant.name;
      } catch (e) {
        console.error("Failed to parse assistant file: ", e);
      }
    }
  }
  description: ProfileDescription;

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
      this.overrideAssistantFile?.path,
    );

    this.description.errors = result.errors;

    return result;
  }

  setIsActive(isActive: boolean): void {}
}
