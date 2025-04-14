import { ConfigResult, parseConfigYaml } from "@continuedev/config-yaml";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { ContinueConfig, IDE, IdeSettings, ILLMLogger } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import { getPrimaryConfigFilePath } from "../../util/paths.js";
import { localPathToUri } from "../../util/pathToUri.js";
import { getUriPathBasename } from "../../util/uri.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";

  constructor(
    private ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private controlPlaneClient: ControlPlaneClient,
    private llmLogger: ILLMLogger,
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
      title: overrideAssistantFile?.path
        ? getUriPathBasename(overrideAssistantFile.path)
        : "Local Assistant",
      errors: undefined,
      uri:
        overrideAssistantFile?.path ??
        localPathToUri(getPrimaryConfigFilePath()),
      rawYaml: undefined,
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
    const result = await doLoadConfig({
      ide: this.ide,
      ideSettingsPromise: this.ideSettingsPromise,
      controlPlaneClient: this.controlPlaneClient,
      llmLogger: this.llmLogger,
      overrideConfigJson: undefined,
      overrideConfigYaml: undefined,
      platformConfigMetadata: undefined,
      profileId: this.description.id,
      overrideConfigYamlByPath: this.overrideAssistantFile?.path,
      orgScopeId: null,
    });

    this.description.errors = result.errors;

    return result;
  }

  setIsActive(isActive: boolean): void {}
}
